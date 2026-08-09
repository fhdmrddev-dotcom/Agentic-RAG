# Phase 187: Business Vocabulary + AI-Seeded Canvas — Research

**Researched:** 2026-08-02
**Domain:** Canvas node vocabulary (React/TS pure derivation) + NL authoring prompt (Python/forced_emit) + harness engine governance-gate control flow
**Confidence:** HIGH (every claim below was measured against live source, the live local DB on :54322, or a live test run; nothing is inherited)
**Measured at:** `develop` @ `132b9b26`, working tree clean of tracked `backend/` `frontend/` `supabase/` source changes

---

## Summary

This phase is **six small surfaces plus one control-flow repair**, and the control-flow repair
(SC#6) is where nearly all the risk lives. Five of the six surfaces are additive and pure — a third
tier in `nodeTitle()`, a per-step `name` sentence in one prompt string, a provenance boolean on
`PhaseSpec`, a slot swap in two adapters, one receipt component, one picker component. The sixth
(D-187-11's `incomplete` verdict) is one check on a shipped seam. SC#6 rewrites the pre-body path of
`_run_phase_with_gates` — the same function that owns every gate, every retry bound and every
`on_failure` route in the harness.

**Three CONTEXT/SPEC claims are refuted by measurement** and the planner must not carry them
forward: (1) D-187-03's "T-185-03-03's accepted doubled gate row disappears" is false — that row is
the `citations_required` doubling, which this phase leaves in place; (2) the SPEC's
`MODEL_CAPABILITIES` figures are wrong on all four counts (it is 61 models / 8 groups, **DeepSeek
is present**, and 5 models declare no `forced_emission`); (3) the project memory's "~14–17
pre-existing frontend vitest failures" is wrong — the measured baseline is **42–49 failures across
11 files, and it is flaky run-to-run**.

**One acceptance criterion is unsatisfiable as written.** SC#5 check 2 ("no two steps within one
workflow render identical faces") is measured over a corpus that includes `four_seed_defs()`, whose
`plan_execute_verify` seed carries two bare `llm_single` steps with no skill, no template and no
folder scope. The D-187-04 derived tier resolves to `null` for both, so they will **still** render
`"Write it up"` twice after this phase ships. The check cannot pass without either narrowing the
corpus or narrowing the check. This is a scope decision the planner must make, not an executor's.

**Primary recommendation:** Plan SC#6 as its own wave, ahead of everything else, with the armed
reading threaded as an explicit **parameter** (`is_action_risk: bool`) into
`_resolve_failure_with_ask_user` rather than as a read off `phase.action_risk_armed` — because that
function serves both the armed checkpoint *and* the author's own `ask_user` gates on the same phase,
and a phase-level read would silently give armed treatment to an unrelated author gate. Everything
else can proceed in parallel: the vocabulary tier, the prompt sentence, the reveal swap, the receipt,
the picker and the verdict share no files.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SC#6 — the armed action-risk checkpoint (SEED-137)**

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

**The derived node face (VOCAB-01 / Req 1, 3, 4)**

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

**The seed receipt (VOCAB-02 / Req 5)**

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

**Scope: the folded bug half, the deferred hole, and SC#10**

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

### Claude's Discretion

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

### Deferred Ideas (OUT OF SCOPE)

- **The armed-phase / synchronous-publish hole (D-187-12).** `_interactive_phase_failures` reads
  the raw definition, so an armed phase publishes past the pre-run interactive fence and its
  checkpoint fires inside the golden run with no subscriber. **Re-open trigger:** whichever phase
  makes publish a background job (the deferred Phase-103 rework named at
  `publish_service.py:478-479`), **or** the first time an armed workflow is published and its
  golden run wedges. Cheap fix when it lands: add `action_risk_armed` to
  `_interactive_phase_failures`, which `/validate` then picks up for free.
- **Per-node review state (✦ drafted / ✓ reviewed, sketch 150-C).** Excluded by SPEC. Owes a
  **placement** (its mark sits at `-left-2 top-1.5`, the transient server-verdict mark's
  coordinates) and a **meaning at publish**. **Re-open trigger:** Phase 188's run state lands on
  these same nodes — decide the corner allocation there, or when a user asks "which of these did I
  actually check?".
- **Filling `technicalLine` (sketch 149-B).** Reserved at `PhaseNode.tsx:183` alongside `status`
  and `stepNumber`. **Re-open trigger:** Phase 188 scoping — it is 188's slot to spend.
- **A direct template → canvas fork on the Builder's first screen (sketch 151-A/B).** Creates a
  second way a workflow comes into existence. **Re-open trigger:** evidence that re-deriving a
  starter from its sentence loses something users notice.
- **Making `harness_authoring_model` a real dynamic setting** (Settings UI + `app_settings` row +
  `load_app_settings` sync). **Re-open trigger:** `BUG-260731-01`'s investigation, the SEED-117
  config-consolidation revival, or the next phase that needs a provider-routed authoring roster.
- **Making `folder_scope` editable per-phase.** Carried forward from **D-186-17**. **Not** made
  editable here.
- **Suppressing the type subtitle when the derived tier resolves.** Rejected as D-187-06's
  alternative. **Re-open trigger:** live UAT showing the `llm_human_input` / `llm_emit`
  restatements read as noise on a real workflow.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **VOCAB-01** | A business user sees plain-language node names/verbs with a Technical-names reveal — extends v3.3 LANG-01 + SEED-085 | §"The derived tier — the plumbing" (exact `nodeTitle`/`toCanvas` call-site census, the 6 vs 1 asymmetry), §"The ⌥ reveal — measured shape of both views" (the spine has **no subtitle slot**; the card title IS `truncate` and the subtitle is NOT, so Req 4's "full slug, no ellipsis" is satisfiable), §"Pitfall 1" (the async name-map flicker), §"Pitfall 4" (the `?raw` guards do NOT trip) |
| **VOCAB-02** | Describe a workflow in NL → seeded, editable canvas draft; the AI seed structurally cannot emit an unsafe node | §"Generation — what is actually wired" (`AUTHORING_SYSTEM_PROMPT:57-89` has no per-step `name`; `PhaseSpec.name` already inside the `extra="forbid"` union; single-shot budget at `workflow_authoring.py:305-320`), §"The seed receipt — the data path" (`kbTools` is already in-page and canvas-gated; `onDraft` at `:1164` is the one arrival transition), §"SC#10 roster" (61 models / 8 groups, all 8 keys configured) |
| **VOCAB-03** | Start from a template / starter flow on the canvas (reuses the shipped Starter Workflow Library) | §"The template door" (`GET /workflows/starters` is un-gated and already has a client at `api.ts:1363`; the 3 curated starters measured live with their full spines; **the describe screen renders on BOTH flag branches** so the door must be `canvasEnabled`-gated for D-181-01) |
| **SC#6** (SEED-137, folded) | An armed action-risk checkpoint is ALWAYS asked | §"SC#6 — the mechanics, measured end to end" (full control flow, the `is_action_risk`-as-parameter finding, the retry-loop placement question, the receipt `validator: failed_idx` consequence, the complete test census) |
| **D-187-11** (`BUG-260731-03` verdict half) | Unbound retrieval workflow caught deterministically before a golden run | §"D-187-11 — the `/validate` seam" (two placements with their blast radii; the `_severity` fail-loud registration requirement; the `test_182_severity_codes.py` emit-site scanner) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config-derived node face (Req 1) | **Browser / Client** (pure module) | — | It is a *display* derivation over data already in hand. `phaseVocabulary.ts` is declared the ONE client vocabulary home and the `?raw` guards enforce it. No server call, no persistence — that is the whole safety property (D-187-05). |
| The id→name lookup context (Req 1) | **Frontend page state** | API (`listFolders` / `listSkills`) | The maps are already fetched once on mount at `WorkflowBuilderPage.tsx:1107-1133` and already threaded to a sibling surface. Threading them further costs zero fetches. |
| Per-step `name` authoring (Req 2) | **API / Backend** (`workflow_authoring.py`) | Provider gateway (`forced_emit`) | The name is *authored data*, so it belongs where the definition is minted. The response schema is unchanged — `PhaseSpec.name` already exists inside the `extra="forbid"` union. |
| Name provenance + demote (Req 3) | **Browser / Client** (`definitionOps.patchPhaseConfig`) | Backend model (`PhaseSpec` field) | The demote fires on a *client edit*; the field must exist on the server model so it survives `model_validate()`. Both halves are additive-optional. |
| The ⌥ reveal slot swap (Req 4) | **Browser / Client** (two adapters) | — | `PhaseNode.tsx:143-144` and `PhaseSpineGraph.tsx:125` are pure `NodeProps → slots` mappings. `technicalTitle` already rides on `data`; no projection change is needed. |
| Seed receipt (Req 5) | **Browser / Client** (new component) | API (`kb_tools` on the grounding bundle) | The *safety-defining* list is the server's (`workflows.py:745`); the client only intersects and renders (D-185-09 / D-187-08). |
| Template picker (Req 6) | **Browser / Client** (new component) | API (`GET /workflows/starters`) | Reads a shipped, un-gated route. Writes only local `describe` state — no second forward path. |
| Armed-checkpoint guarantee (SC#6) | **API / Backend** (`harness_engine.py`) | — | It is a *runtime* guarantee about whether a body executes. It can only be enforced where the body is invoked. The client shows nothing here (Phase 188 owns the run surface). |
| Unbound-retrieval verdict (D-187-11) | **API / Backend** (`/validate`) | Browser (renders the message verbatim) | "Invitation ≠ verdict" (D-184-15 / D-182-06): the server owns every verdict; the client never mints a severity. |

---

## Project Constraints (from CLAUDE.md)

| Directive | How it binds this phase |
|---|---|
| Python backend must use a `venv` | All backend commands run through `backend/venv/Scripts/python.exe`. Confirmed working (`psycopg2` present in the venv, absent from the system Python). |
| No LangChain / LangGraph — raw SDK only | Untouched. `forced_emit` → Phase 092.5 gateway (red line D-14). |
| Pydantic for structured LLM outputs | `WorkflowDefinition` IS the emit schema; `PhaseSpec.name` is already a field. |
| All tables need RLS | No new tables. `/validate` reads via service-role with hand-scoping inside `grounding.py` (existing posture). |
| Schema changes ship as numbered SQL migrations | **This phase ships ZERO migrations.** Every new field is additive-optional inside the `definition` JSONB. Verified: `harness_audit`'s `event_type` CHECK already lists `action_risk_pending` and `validator_ask_user_approved` (23 values) so the hoisted checkpoint needs no new audit kind. |
| Do not run blocking I/O in async handlers | `listFolders`/`listSkills` are frontend. Backend: no new blocking call introduced. |
| Settings live in `user_settings`/`app_settings`; env for secrets/infra | **Violated today by `harness_authoring_model`** (`config.py:1164`, env-only, absent from BOTH `backend/.env.example` and `deploy/onebox.env.example`). D-187-13 works around it rather than fixing it. If the phase adds it to `.env.example`, the **deployment-artifact same-commit rule (D-16)** fires: `deploy/onebox.env.example` + `docs/OPERATOR.md` + `scripts/check-deploy-drift.sh`'s `OMITTED_FROM_ONEBOX` must move together. |
| Provider-docs-first (evidence-based) | SC#10 is a *registry-driven* roster, not a provider-behaviour claim. No provider-doc research is owed unless a row fails and the failure is provider-specific. |
| **UAT scoreboard recipe** — full native roster + OpenRouter, derived from `MODEL_CAPABILITIES`, never re-typed; blocked rows ⛔ never omitted | Derived live below (§"SC#10 roster"). **8 groups, DeepSeek included.** All 8 keys are configured locally ⇒ zero ⛔ rows expected. |
| **G-2** sketch before plan for UX | **Satisfied** — sketches 148/149/150/151 wrapped into the project skill (`node-vocabulary-and-reveal.md`, `ai-seed-and-templates.md`, `icon-convention.md` §4). |
| **G-4** lived-experience UAT gate | This phase touches user-visible UI on four surfaces. Operator-defined "I'd recognize failure here" rows are owed at scope time — see §"Validation Architecture" → Manual-Only. |
| **G-5** hot-file ledger | `WorkflowBuilderPage.tsx` (measured **1810 L**) takes two mount lines; D-187-14 makes the diff a phase gate. `PhaseNode.tsx` takes the reveal change. `WorkflowCanvas.tsx` (1574 L) **must not be touched** by this phase — its extraction is due in 188. `PhaseNodeCard.tsx` **is not modified** (its two invariants are respected by construction: no third badge, no focusable control). |
| **G-6** failure criteria upfront | SPEC has 23 falsifiable acceptance criteria. §"Open Questions" records the one that cannot be met as written. |
| **Reported-bugs cross-check (plan-phase touchpoint)** | Exactly **one** report names 187: `BUG-260731-03` (`folded_into: "186 (control) / 187 (verdict)"`, status `folded`, severity `blocking`). **At least one plan task must cover D-187-11**, and the report's frontmatter must be updated in the same phase. No other open `surface: Agentic-RAG` report claims 187. |

---

## Runtime State Inventory

> This is not a rename phase, but it **does** add a field to a JSONB shape that lives in a live
> database and in already-running code paths. The categories below are answered for that.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `workflow_definitions.definition` (172 rows) is the only JSONB column that can carry a `ValidatorSpec` or a `PhaseSpec` — verified by enumerating every `jsonb`/`json` column in `public` (30 columns). **0 rows name `action_risk_approval`.** 1 row carries `"action_risk_armed": true`. | None for the provenance marker (additive-optional reads absent). Removing the `action_risk_approval` Literal is **safe on this DB** — but see §"Don't Hand-Roll" for why it should be kept anyway. |
| **Live service config** | None. No n8n / Datadog / Cloudflare surface is touched. | None — verified: this phase adds no external service. |
| **OS-registered state** | None. No Task Scheduler / pm2 / systemd registration references anything this phase renames. | None — verified: no rename occurs. |
| **Secrets / env vars** | `HARNESS_AUTHORING_MODEL` is read by `Settings` (`config.py:1164`) but appears in **neither** `backend/.env.example` **nor** `deploy/onebox.env.example`. Current live value: `None` (unset). All 8 provider `*_api_key` fields are populated locally. | D-187-13's live row sets `HARNESS_AUTHORING_MODEL` and restarts. **If the var is added to `.env.example`, the D-16 same-commit deploy-artifact rule fires.** |
| **Build artifacts / installed packages** | None. No `pyproject.toml` rename, no sandbox package-set change, no new dependency in either `package.json` or `requirements.txt`. | None — verified: this phase installs nothing (see §"Package Legitimacy Audit"). |
| **Run-time durable rows (extra category, relevant here)** | `harness_audit.event_type` is a **closed CHECK constraint of 23 values** — `action_risk_pending` and `validator_ask_user_approved` are both present. `harness_audit` currently holds 2 `action_risk_pending` rows and 1 `validator_ask_user_approved` row. | **Hard constraint:** the hoisted checkpoint MUST reuse those two event types. A new kind needs a migration, and this phase ships zero. |

---

## Standard Stack

This phase introduces **no new library**. Everything is composed from what already ships.

### Core (all already installed and in use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | v12 (per v3.6 roadmap) | Canvas host; `PhaseNode` is a `NodeProps` adapter | Locked at Phase 183; not touched by this phase beyond the adapter body |
| `pydantic` | 2.12 (`pydantic_core` 2.12 path observed in the venv) | `PhaseSpec` / `ValidatorSpec` / `WorkflowDefinition` strict models | The `extra="forbid"` union IS SC#3's safety mechanism |
| `vitest` | **4.1.0** (measured) | Frontend test runner | ⚠ `--reporter=basic` **no longer exists** in v4.1 — it fails with `Failed to load url basic`. Use the default reporter or `--reporter=json --outputFile=…` |
| `pytest` | 9.0.2 (measured from `__pycache__` tags) | Backend test runner | 3474 tests collected |
| `psycopg2` | present in `backend/venv` only | Evidence tool for live DB reads on :54322 | Not on the system Python — always invoke `backend/venv/Scripts/python.exe` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Threading a name context through `toCanvas` (D-187-05) | Fetching folder/skill names inside `phaseVocabulary.ts` | **Rejected by D-183-12 + the module's own purity contract** — it "imports NOTHING from the API client". Also breaks the byte-identical-when-omitted property. |
| A dedicated `_run_armed_checkpoint` that re-implements the pause | Reusing `_resolve_failure_with_ask_user` with an explicit flag | Reuse is strongly preferred — the shipped path already owns the durable prompt row, the SUBSCRIBE-before-emit ordering, the indefinite wait, the shutdown-`CancelledError` escape, the approval allow-list and the receipt. Re-implementing any of those re-opens T-185-04-01 (the fail-open BLOCKER). |
| Emitting D-187-11's verdict from `grounding.grounding_verdicts` | Minting it in the `/validate` route (`_ROUTE_ASSIGNED_CODES`) | `grounding_verdicts` is **shared with publish** (182-06 made publish enforcing), so a check added there becomes a **publish blocker** as well as a canvas verdict. See §"D-187-11" for the recommendation. |

**Installation:** none. `npm install` / `pip install` are not required by this phase.

---

## Package Legitimacy Audit

**This phase installs zero external packages.** Every requirement is satisfied by code already in
the repository. No `npm install`, no `pip install`, no new `requirements.txt` or `package.json`
entry is called for by any of the 7 requirements or the 14 decisions.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | N/A — phase installs nothing |

**Packages removed due to slopcheck [SLOP] verdict:** none — none were proposed.
**Packages flagged as suspicious [SUS]:** none.

*If a plan later proposes a package (e.g. a popover primitive for the template picker), it must run
the Package Legitimacy Gate first. Note that `shadcn/ui` + Radix primitives are already vendored in
this repo — check `frontend/src/components/ui/` before adding anything.*

---

## Architecture Patterns

### System Architecture Diagram

```
                                THE SEED PATH (Req 2, 5, 6)
                                ───────────────────────────

  [Template picker]  ──sets text──▶  describe state (WorkflowBuilderPage.tsx:558)
   GET /workflows/starters                     │
   (api.ts:1363, un-gated)                     │ user presses "Draft the workflow"
                                               ▼
                                    onDraft()  (:1164)
                                               │
                                               ▼
                              POST /workflows/generate  (api/workflows.py:1288)
                                               │  require_visible("workflow_authoring")
                                               ▼
                       generate_workflow_definition(settings=…)  (workflow_authoring.py:217)
                                               │
                          resolve_authoring_model(settings)  (:92)  ── env-only
                                               │
                          _assemble_grounding ──▶ harness/grounding.py  (one home)
                                               │
                          forced_emit(schema_model=WorkflowDefinition, strict=False)
                                    exactly 1 call (2 on first-pass ValidationError, never 3)
                                               │
                                               ▼
                                  {ok, definition}   ← NO grounding verdict (D-187-08)
                                               │
                                   store.setDrafted(def)   ← ONE state transition
                                               │
                     ┌─────────────────────────┼──────────────────────────┐
                     ▼                         ▼                          ▼
            [Seed receipt]            toCanvas(phases,{kbTools})      POST /workflows/validate
         groundingCauseOf(phase,        (WorkflowCanvas.tsx:879)      (every canvas edit)
           kbTools) per step                   │                          │
         kbTools ← useGroundingBundle           ▼                   grounding_verdicts + lint
           (canvasEnabled)              buildPhaseData (:278)       + business_requirement
                                               │                    + _interactive_phase_failures
                                    nodeTitle(phase, nameCtx?)      + [D-187-11 unbound-retrieval]
                                               │                          │
                                               ▼                          ▼
                                      PhaseNode.tsx:140            {ok, verdicts[]}  → blockedReason
                                  title = data.title  (ALWAYS)              (:1093)
                                  subtitle = technical ? technicalTitle
                                                       : data.subtitle
                                               │
                                               ▼
                                      PhaseNodeCard (:317 truncate title,
                                                     :321 wrapping subtitle)


                          THE ARMED-CHECKPOINT PATH (SC#6)
                          ────────────────────────────────

  run_workflow (:1240)
      │
      │  spec_by_slug = { slug: effective_phase(p, total_phases) }   (:1336-1339)
      │       effective_phase appends  ─┬─ action_risk_approval (timing=pre)  ← D-187-03 REMOVES
      │       (grounding.py:877-953)    └─ citations_required   (timing=post) ← STAYS (confirmed)
      ▼
  _run_phase_with_gates
      │
      ├─ pre = run_gates(phase, …, timing="pre")        validators.py:214-249
      │       └─ returns the FIRST failure (loop head :230, return :248)
      │
      ├─ if not pre.passed:
      │       ├─ _is_action_risk_finding(msg)  (:706 / :931)  ← D-187-03 DELETES
      │       │      ├─ TRUE  → write_audit("action_risk_pending") + _emit  (:712-721)
      │       │      └─ FALSE → write_audit("gate_failed") + _emit          (:723-730)
      │       ├─ outcome = _resolve_failure_with_ask_user(…, is_pre=True)   (:731-736)
      │       │      └─ is_action_risk = _is_action_risk_finding(msg) (:1001)
      │       │           gates 5 deltas: prompt · timeout=None · shutdown-Cancelled
      │       │                           · choices · approval ALLOW-LIST (:1194)
      │       └─ if outcome is not None: return       (:737-738)
      │          ▼
      │  ★★ :739  "outcome is None → ask_user Proceed: fall through and run the body"
      │           ↑ THE BYPASS.  D-187-01/02 inserts the explicit checkpoint HERE.
      ▼
    while True:                                        (:743)
        output = await _execute_phase(...)             (:747)  ← THE BODY
        gate = run_gates(phase, output, timing="post") (:766)
        …retry / _route_on_failure / _resolve_failure_with_ask_user(:818)
```

### Recommended Project Structure (new files only)

```
frontend/src/components/workflows/
├── SeedReceipt.tsx              # Req 5 — its own file (D-187-14); one gated mount line in the page
├── SeedReceipt.test.tsx
├── StarterTemplatePicker.tsx    # Req 6 — its own file; one gated line under the CTA
└── StarterTemplatePicker.test.tsx

backend/tests/unit/
├── test_187_armed_checkpoint_property.py   # SC#6 — the RED-first property test
└── test_187_authoring_step_names.py        # Req 2 + SC#10 roster (8 rows, serial)
```

Everything else is an **edit** to a shipped file. The edited set is:
`phaseVocabulary.ts`, `canvasModel.ts`, `PhaseNode.tsx`, `PhaseSpineGraph.tsx`, `definitionOps.ts`,
`WorkflowBuilderPage.tsx`, `harness.py`, `grounding.py`, `harness_engine.py`,
`workflow_authoring.py`, `api/workflows.py`.

### Pattern 1: The optional injected context (the exact D-187-05 precedent)

**What:** an external, safety- or display-relevant lookup is passed IN with a safe default, so the
projection stays pure and every existing caller renders byte-identically.
**When to use:** whenever a pure client module needs a value it must not fetch.

```typescript
// Source: frontend/src/components/workflows/canvasModel.ts:314-330 (shipped, Phase 185 / D-185-09)
export interface ToCanvasOptions {
  /** The server-supplied KB-reading tool names. Absent or empty marks nothing. */
  kbTools?: readonly string[]
}

/** Module-scope so an omitted `kbTools` hands the same reference on every call —
 *  the projection must be deterministic to the byte (the snapshot gate depends on it). */
const NO_KB_TOOLS: readonly string[] = Object.freeze([])

export function toCanvas(phases: PhaseSpecJSON[], options: ToCanvasOptions = {}): CanvasProjection {
  const kbTools = options.kbTools ?? NO_KB_TOOLS
  // …
}
```

The name context must copy this shape exactly, including the **frozen module-scope empty default**
— `canvasModel.fixtures.test.ts:86` holds a `toMatchSnapshot()` over `toCanvas(phases)` and a fresh
object per call would be a needless identity change.

### Pattern 2: The phase-shaped adapter over a flat pure core

**What:** the rule is a total function of flat inputs; a thin adapter reads them off a phase.
**When to use:** when two consumers hold the data in different shapes (the panel holds five props,
the canvas holds a whole phase).

```typescript
// Source: frontend/src/components/workflows/phaseVocabulary.ts:265-310 (shipped)
export function groundingCause(inputs: GroundingInputs): GroundingCause { /* branch order load-bearing */ }

export function groundingCauseOf(phase: PhaseSpecJSON, kbTools: readonly string[]): GroundingCause {
  const rawTools = phase.config.available_tools
  return groundingCause({
    phaseType: phase.config.phase_type,
    // defensive: PhaseConfigJSON is the LOOSE JSONB read shape, a hand-edited row can carry anything
    availableTools: Array.isArray(rawTools) ? rawTools.filter((t): t is string => typeof t === "string") : [],
    kbTools,
    groundingEscalated: phase.grounding_escalated === true,
    citationPolicy: typeof phase.config.citation_policy === "string" ? phase.config.citation_policy : undefined,
  })
}
```

The derived tier should follow this: a flat `derivedFaceOf(inputs)` core plus a phase-shaped
adapter, with the same defensive reads (CANVAS-01 totality — `phaseVocabulary.test.ts:150-151`
already asserts `nodeTitle` does not throw on a malformed phase).

### Pattern 3: Additive-optional, zero-migration `PhaseSpec` field

```python
# Source: backend/app/models/harness.py:201-235 (shipped)
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None  # REQ-3 — pre-103 rows validate with it absent

    grounding_escalated: bool = False   # D-185-08 — `bool = False`, NOT `bool | None`
    action_risk_armed: bool = False     # so "not set" has exactly ONE spelling
```

The provenance marker copies `grounding_escalated`'s spelling: **`bool = False`, never
`bool | None = None`**. The docblock at `:208-233` explains why a `model_validator` would be fatal
(the save path is `json.dumps(definition.model_dump(mode="json"))`, so a derivation in the model
gets baked into the JSONB permanently).

### Anti-Patterns to Avoid

- **Reading "is this phase armed" off `phase.action_risk_armed` inside
  `_resolve_failure_with_ask_user`.** That function serves both the armed checkpoint and the
  author's own `ask_user` gates *on the same phase*. Its shipped docblock (`:934-939`) says so
  explicitly: *"an armed phase can carry authored gates too, and only the armed one gets the armed
  treatment."* A phase-level read would give an unrelated freshness gate the indefinite timeout, the
  shutdown-`CancelledError` escape and the exact-match approval allow-list. **Pass `is_action_risk`
  as an explicit parameter.**
- **Storing the derived title.** The property that makes it safe is that it is computed
  (`harness.py:218-229`, `phaseVocabulary.ts` header).
- **A second copy of the vocabulary anywhere.** The `?raw` guards
  (`PhaseSpineGraph.test.tsx:180-194`, `PhaseSpine.test.tsx:104-117`) forbid a local
  `const PHASE_GLYPHS`, `const PHASE_TYPE_LABELS`, a local `parseSkipTarget` or a local
  `interface PhaseSpecJSON` inside the two spine files.
- **Spending badge slot 1 or the card's top-right corner.** `BadgeSlots` is a max-2 tuple union
  (`PhaseNodeCard.tsx:148`) — a third badge is a typecheck error. The corner is the governance seal's
  permanently.
- **Putting a focusable control inside `PhaseNodeCard`.** Its docblock (`:50`) states the invariant;
  the template picker and the receipt live outside the card entirely.
- **Adding a new `harness_audit` event type.** The CHECK constraint is closed at 23 values and this
  phase ships zero migrations.
- **Using `--reporter=basic` with vitest 4.1.** It does not exist and fails the run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pausing a run for a human decision | A new pub/sub block in the armed checkpoint | `_resolve_failure_with_ask_user` (`harness_engine.py:944-1229`) with an explicit `is_action_risk=True` | It already owns the durable prompt row, the emit-on-producer-stream, SUBSCRIBE-before-emit, the indefinite wait, the shutdown-`CancelledError` escape (`:1120`), the **exact-match approval allow-list** (`:1194`, the T-185-04-01 fail-open fix) and the receipt write (`:1215`). Re-implementing any one of those re-opens a closed BLOCKER. |
| Deciding "does this step read the KB" | A frontend constant of KB tool names | `groundingCauseOf(phase, kbTools)` over server `kb_tools` | D-182-06 red line. `grounding.py:797-803` `KB_TOOLS` is the ONE home; the client receives it as data on `GET /workflows/grounding-bundle` (`workflows.py:745`). A 6th KB tool would silently stop being marked by a frontend constant. |
| Composing the approval prompt sentence | A new string in the engine | `grounding._approval_sentence(phase, total_phases)` (`:850-874`) | It is the only place `len(definition.phases)` is in hand, and its honesty rules (position / identity / consequence, never "approved"/"safe"/"proven") are asserted character-identically by `test_185_engine_attachment.py:407-451`. |
| Classifying a `/validate` finding's severity | A literal in the route | Register the code in its owning module's set + `_INCOMPLETE_CODES` | `_severity` (`workflows.py:502-540`) **fails LOUD to `error`** on an unrecognised code and logs a warning naming it. `test_182_severity_codes.py` scans the owning modules' emit sites with `re.compile(r'"code":\s*"([a-z_]+)"')` and fails on drift. |
| The `skip_to_phase` parse | Anything | `parseSkipTarget` (`phaseVocabulary.ts:113`) | Pinned to the backend by a shared fixture read by BOTH `phaseVocabulary` vitest and `backend/tests/unit/test_183_skip_parse_parity.py`. |
| A starters list / fork | A new endpoint or a client-side filter | `GET /workflows/starters` (`api/workflows.py:223`) + `listStarterWorkflows` (`api.ts:1363`) | Already shipped, already un-gated (documented RUN CARVE-OUT), already returns `definition` so the picker can render the spine. |
| A workflow "category icon" | A phase-type glyph per starter | The starter's **phase SPINE** | icon-convention §4, finding #36. `icon3d('llm_agent')` means "this STEP is an agent step", not "this WORKFLOW is about risk". This was a real correction during the sketch review. |

**Key insight:** every "new" capability in this phase already has a shipped one-home implementation
one import away. The measured failure mode in this codebase is not missing machinery — it is a
*second copy* of machinery that already exists, which then drifts. Two shipped guard mechanisms
(`?raw` source greps, the severity-code emit-site scanner) exist specifically to catch that.

---

## SC#6 — the mechanics, measured end to end

### The current control flow (`harness_engine.py:684-741`)

| Line | What happens |
|---|---|
| `:684-686` | `validators = list(phase.validators)`; `phase_max_retries = validators[0].max_retries if validators else 2`; `failed_idx = None`. **This is the WR-03 seed D-187-01 protects.** |
| `:695` | `pre = await run_gates(phase, {"_phase_inputs": …}, ctx, timing="pre")` |
| `:696` | `if not pre.passed:` |
| `:706` | `if _is_action_risk_finding(pre.error_message):` → the armed branch |
| `:712-716` | `write_audit(event_type="action_risk_pending", metadata={"phase": slug, "timing": "pre"})` |
| `:721` | `_emit(redis, stream_run_id, "action_risk_pending", phase=slug)` |
| `:723-730` | else-branch: `gate_failed` audit + emit |
| `:731-736` | `outcome = await _resolve_failure_with_ask_user(phase, pre.error_message, 0, pre.validator_index, …, is_pre=True)` |
| `:737-738` | `if outcome is not None: return outcome` |
| **`:739`** | **`# outcome is None → ask_user Proceed: fall through and run the body`** — the bypass |
| `:741-743` | `attempt = 0`; `last_output = None`; `while True:` |
| `:747-750` | `output = await asyncio.wait_for(_execute_phase(...), timeout=wall_clock)` — **THE BODY** |

`run_gates` (`validators.py:214-249`): the enumerate loop head is at **`:230`**, the timing filter
at `:231-232`, the unknown-kind fail-closed return at `:237-241`, and the **first-failure return at
`:248`** (`return result._replace(validator_index=idx)`). The ROADMAP's "`validators.py:230`
first-failure-wins" points at the loop head, not the return — the substance is correct, the line is
18 off.

**Correcting the ROADMAP's other two line citations** (measured 2026-08-02):
- `grounding.py:951-953` is `if not extra: return phase` + the `model_copy`. The **armed append** is
  at **`:920-933`** (the `if getattr(phase, "action_risk_armed", False):` test is `:924`).
- `harness_engine.py:737-739` is correct.

### CONFIRMED — the `citations_required` gate is `timing="post"` and unreachable by this hazard

`grounding.py:935-949`:

```python
if grounding_cause(phase) == "detected":
    extra.append(ValidatorSpec(kind="citations_required", timing="post",
                               on_failure="fail_run", max_retries=2,
                               config={"mode": "retrieved_and_cited"}))
```

`timing="post"` ⇒ it is filtered out of the `timing="pre"` pass at `validators.py:231` and only
runs at `:766` **after** the body has already executed. A pre-gate preempting it is not
representable. **D-187-03's "confirm rather than assume" is discharged: it stays exactly as-is.**

### `_resolve_failure_with_ask_user` — what it does and its re-entrancy story

Signature (`:944-958`): `(phase, error_message, attempt, failed_idx, *, run_id, pool, redis, ctx,
_audit_user_id, stream_run_id=None, produced_output=None, is_pre=False)`.

Body:
1. `:979` — `disp = _parse_on_failure(_failing_on_failure(phase, failed_idx))`. **If the disposition
   is not `ask_user`, it delegates to the sync `_route_on_failure` and returns.** A hoisted
   checkpoint has no index into `phase.validators`, so this line is the first thing the planner must
   handle (see "The three consequences" below).
2. `:988-989` — no redis or no run_id ⇒ fail safe to `_route_on_failure`, never a hung run.
3. `:1001` — **`is_action_risk = _is_action_risk_finding(error_message)`** — the single gate for all
   five Phase-185 deltas.
4. `:1005-1017` — DELTA 1, the prompt: armed uses `error_message.split("|", 1)[1]` verbatim.
5. `:1027-1032` — DELTA 2, `timeout_seconds = None` when armed (never `0` — the card renders `0` as
   already-expired).
6. `:1039-1069` — the durable `messages` row (best-effort, wrapped in try/except).
7. `:1078-1084` — `emit("ask_user_prompt", …)` on `ctx.producer_run_id or stream_run_id or run_id`.
8. `:1092-1098` — `subscribe_for_response(redis, run_id, tool_call_id, timeout)`; armed passes
   `None` straight through.
9. `:1120-1124` — DELTA 3, `{"kind":"shutdown"}` on an armed gate raises `asyncio.CancelledError` so
   the phase stays `active` for the boot-time resume sweep.
10. `:1130-1140` — `payload is None` ⇒ `fail_run` (fail-closed; unreachable for armed except on an
    unparseable payload).
11. `:1156-1159` — `_is_abort_choice(choice)` ⇒ `fail_run`. **Ordering is load-bearing** and must
    stay first.
12. **`:1194-1198`** — DELTA 5, the armed ALLOW-LIST: `if is_action_risk and choice !=
    _ACTION_RISK_APPROVE_CHOICE: return fail_run("…not approved: the answer did not match the
    approval option")`. This is the T-185-04-01 fail-open fix — exact equality, not casefold, not
    prefix.
13. `:1200-1229` — the receipt: `write_audit(event_type="validator_ask_user_approved",
    metadata={"phase", "validator": failed_idx, "choice", "finding"})`, then `return None` for
    `is_pre=True` (signal: run the body).

**Re-entrancy:** the function is *not* re-entrant-safe by design and does not need to be — every
call mints a fresh `tool_call_id = uuid4().hex` (`:1003`) and subscribes on that id, so two
sequential calls on one phase (an author `ask_user` Proceed followed by the armed checkpoint —
exactly D-187-02's accepted two-prompts-in-a-row cost) are two independent rendezvous. There is no
shared mutable state between calls. **The `ctx.retry_feedback` field is the only cross-call state,
and it is cleared at `:774` / `_clear_retry_feedback`.**

### The three consequences of hoisting that the planner must decide explicitly

**(a) `is_action_risk` must become a PARAMETER, not a phase read.** ⚠ This partially contradicts
D-187-03 as written. D-187-03 is right that the *trigger* becomes `phase.action_risk_armed`. But
inside `_resolve_failure_with_ask_user` the reading answers a different question — *"is THIS CALL
the armed checkpoint?"* — and the shipped docblock says why it must stay per-call:

> *"It is taken off the FINDING rather than off the phase because the finding is what identifies
> WHICH validator failed — an armed phase can carry authored gates too, and only the armed one gets
> the armed treatment."* (`harness_engine.py:934-939`)

If the reading becomes `phase.action_risk_armed`, then an author's freshness `ask_user` gate on an
**armed** phase would inherit: an indefinite wait (no expiry), the shutdown-`CancelledError` escape,
the armed choice pair, and the exact-match allow-list. That is a silent behaviour change on a path
185 deliberately left byte-identical. **Recommendation: add a keyword-only `is_action_risk: bool =
False` parameter; the hoisted checkpoint passes `True`, the validator path passes nothing.** This
still satisfies D-187-03's *"exactly ONE reading of this phase is armed"* — the *phase-level*
reading is `phase.action_risk_armed` at the hoist site and nowhere else.

⚠ **There is already a SECOND boolean reading of `action_risk_armed` in the engine**:
`_is_armed_action_risk(active_phase, definition)` at `harness_engine.py:2148-2170`, used by the
boot-time resume sweep at `:2057`. Its own docblock says the two predicates are *"INDEPENDENT and
deliberately kept so"*. So after D-187-03 there will be **two** phase-level armed readings, not one.
The planner must either reuse `_is_armed_action_risk`'s spelling at the hoist site or record the
deviation — do not claim "exactly one reading" without checking `:2148`.

**(b) `_failing_on_failure(phase, failed_idx)` has nothing to resolve.** With the armed spec gone
from `phase.validators`, there is no index. `_parse_on_failure(_failing_on_failure(phase, None))`
would resolve from the phase's *own* validators — potentially routing the armed checkpoint through
an author's `fail_run` and skipping the pause entirely. **This is a fail-open regression risk and
must be closed explicitly** — either short-circuit the disposition check when `is_action_risk` is
True, or route the checkpoint through a dedicated wrapper that never consults `_failing_on_failure`.

**(c) The `harness_audit` receipt's `validator` field changes shape.** Today
`metadata["validator"] = failed_idx` is the armed spec's index (an int). After the hoist it becomes
`None`. That is a *governance artifact* shape change on the `validator_ask_user_approved` row. It is
almost certainly the honest value (there is no validator), but it must be a decision, not a side
effect — and the audit-ledger vocabulary rule (consequence ≠ receipt) means a reviewer will ask.

**(d) Where inside the function does the checkpoint fire — before or inside the retry loop?**
D-187-02 says "immediately before the body". The body is at `:747`, **inside** `while True:` at
`:743`. Placing the checkpoint inside the loop asks on every retry (up to `max_retries + 1`
prompts). Placing it before `attempt = 0` (`:741`) asks exactly once per phase execution, matching
the pre-gate pass's own once-per-phase shape. **Recommendation: before the loop.** Record it — the
SPEC and CONTEXT do not settle it.

### Which tests assert the current shape — the complete census

**`backend/tests/unit/test_185_engine_attachment.py`** (836 L, 25 tests). Runs green today.

| Test | Line | Effect of the hoist |
|---|---|---|
| `test_detected_step_with_no_declared_validator_gains_the_engine_gate` | 65 | unaffected (citations) |
| `test_detected_step_fails_the_gate_on_uncited_output` | 82 | unaffected |
| `test_deleting_the_declared_validator_does_not_remove_enforcement` | 109 | unaffected |
| **`test_a_deliberately_weak_author_spec_cannot_loosen_the_gate`** | **136-166** | **THE WR-03 RETRY-SEED PROOF (`:153-165`). D-187-01 leaves it green as-is** — it exercises only the `citations_required` append. This is the ROADMAP threat-model item. |
| **`test_arming_adds_no_phase_and_moves_no_phase_index`** | **170-201** | **BREAKS.** `:191-196` asserts `effective[1].validators[0].kind == "action_risk_approval"` and its `config["prompt"]`. Must be re-shaped: after the hoist an armed phase's `effective_phase` returns identity (or the citations-only copy). The *sentence* assertions should move onto `_approval_sentence` directly. |
| `test_an_ungoverned_phase_is_returned_by_reference` | 205 | **strengthens** — more phases now return by reference |
| `test_synthesis_never_mutates_the_parsed_phase` | 230 | unaffected |
| `test_grounding_declares_no_model_validator_in_CODE` | 246 | unaffected |
| `test_armed_gate_subscribes_with_no_timeout_at_all` | 325 | likely needs re-pointing at the new entry point |
| `test_criterion_19_unanswered_armed_gate_does_not_advance_the_run` | 376 | re-point |
| **`test_armed_prompt_is_the_generated_sentence_character_identically`** | **407-451** | re-point; it already imports `_approval_sentence` directly (`:418`) so the assertion survives |
| `test_armed_prompt_and_row_carry_a_null_deadline_never_zero` | 452 | re-point |
| `test_shutdown_mid_wait_leaves_an_armed_run_resumable` | 492 | re-point |
| `test_shutdown_on_a_NON_armed_gate_still_fails_the_run` | 523 | **must stay green unchanged** — it is the asymmetry proof |
| `test_criterion_20_exec_llm_human_input_is_untouched` | 560 | must stay green |
| **`test_an_armed_pre_gate_records_a_pause_not_a_failure`** | **647** | re-point at the hoisted checkpoint's audit write |
| **`test_an_armed_pre_gate_never_announces_gate_failed_to_the_frontend`** | **666** | re-point |
| **`test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped`** | **683** | **must stay green unchanged** — the regression net |
| `test_the_two_resume_predicates_are_independent` | 737-760 | unaffected; **this is the test that pins `_is_armed_action_risk` as a second, independent reading** |
| `test_a_restart_re_subscribes_the_armed_prompt_with_no_deadline` | 796 | unaffected (resume path) |
| `test_an_armed_phase_with_no_durable_prompt_row_falls_through_unchanged` | 818 | unaffected |
| `test_an_llm_human_input_resume_still_uses_its_original_timeout` | 829 | unaffected |

**`backend/tests/unit/test_ask_user_disposition.py`** — 8 armed tests, all driving
`_resolve_failure_with_ask_user(_armed_phase(), _ARMED_FINDING, 0, 0, …, is_pre=True)`:
`:296` choices, `:351` decline, `:377` approval+receipt, `:405` empty answer, `:431` decline by
index, `:539` typed refusal (the T-185-04-01 proof), `:582` approval by index, `:599`
non-armed free-text fall-through (**must stay green unchanged**). All 8 will need the
`is_action_risk=True` parameter instead of the finding string — a mechanical edit, but 8 of them.

**`backend/tests/unit/test_validator_kinds.py:308`** `test_action_risk_approval_always_fails_with_the_structured_prefix`
and **`:318-319`** asserting `"action_risk_approval" in VALIDATOR_REGISTRY`.
**`backend/tests/unit/test_harness_models.py:218-230`** `test_action_risk_approval_is_a_registered_validator_kind`.
Both stay green **iff the Literal and the registered validator are kept** (recommended — see below).

**Baseline measured:** `test_185_engine_attachment.py` + `test_ask_user_disposition.py` +
`test_validator_kinds.py` + `test_harness_models.py` + `test_182_severity_codes.py` = **72 passed,
0 failed, 0.88 s**.

### The `ValidatorSpec.kind` Literal — measured verdict

**Live DB (`:54322`, 2026-08-02):**
- `workflow_definitions`: 172 rows. Rows whose `definition::text` contains `action_risk_approval`:
  **0**.
- `workflow_definitions.definition` is the **only** `jsonb`/`json` column in `public` that can carry
  a `ValidatorSpec` (verified by enumerating all 30 jsonb columns; `workflow_runs` has no definition
  snapshot column — only `definition_id` + `inputs`; `workflow_phases` has `output` only).
- `harness_audit.metadata` mentions `action_risk` in **1** row (the `finding` inside the one
  `validator_ask_user_approved` receipt) — but `harness_audit.metadata` is never
  `model_validate()`d against `ValidatorSpec`.

**So removal is technically safe on this database.** **Recommendation: KEEP the Literal member and
the registered validator.** Reasons: (1) removal breaks 3 shipped tests for zero benefit;
(2) `harness.py:10-21` states the explicit rule — *"What must NOT change is an EXISTING member's
spelling"* and growth is safe, so the codebase's own policy is additive-only; (3) the **cloud**
database was not measured and cannot be from here; (4) with the engine no longer sniffing the
finding prefix, an author-declared `action_risk_approval` validator becomes an ordinary
always-failing gate — and `publish_service.py:464-503` already refuses author-declared `ask_user`
validators, so it cannot become a pause. Record the retention as deliberate (D-187-03 asks for a
decision, not a removal).

### ⚠ REFUTED: "T-185-03-03's accepted doubled gate row disappears" (D-187-03)

Measured at `.planning/phases/185-…/185-03-PLAN.md:364` and `185-SECURITY.md:58`, `:269`:

> *T-185-03-03 | Repudiation | gate audit trail | accept | … `validator_index` stays correct
> end-to-end because the spec is appended and `run_gates` enumerates the full list. **Accepted cost:
> a doubled gate row on hand-strict steps.***

The "doubled gate row" is the **`citations_required`** doubling — an author who declares their own
`citations_required` validator gets two specs (theirs at index 0, the engine's at index N). That is
`grounding.py:940-949`, which D-187-03 explicitly **leaves in place**. Removing the armed append
does not touch it. **The claim is false as written; the doubled row does not disappear.**

### `validator_index` accounting — nothing to re-account

`run_gates` (`validators.py:230`) enumerates the **full** `phase.validators` list and the timing
filter `continue`s without consuming an index (`:231-232`, with the invariant spelled out at
`:225-228`). The armed spec is **appended last** (`grounding.py:953`,
`[*phase.validators, *extra]`), so removing it changes `len(validators)` by 1 for armed phases and
**shifts no other index**. The WR-03 seed at `harness_engine.py:685` reads `validators[0]`, which is
unchanged either way.

**Tests that assert index values:** `test_harness_gates.py:401-422` (`validator_index == 1`),
`test_pre_post_timing.py:33-54` (full-list index under a timing filter),
`test_185_engine_attachment.py:98` (`== 0`) and `:165` (`== 1`). **None of them involves an armed
phase** — all four exercise `citations_required` / freshness / regex specs. **Zero index tests
change.** D-187-03's arithmetic claim is true but vacuous.

---

## The derived tier — the plumbing (D-187-05)

### `nodeTitle()` today

```typescript
// Source: frontend/src/components/workflows/phaseVocabulary.ts:169-174
export function nodeTitle(phase: PhaseSpecJSON): string {
  const name = phase.name?.trim()
  if (name) return name
  const type = phase.config.phase_type
  return PHASE_TYPE_SENTENCES[type] ?? type
}
```

Six `PHASE_TYPE_SENTENCES` (`:127-134`), six `PHASE_TYPE_SUBTITLES` (`:137-144`), six
`PHASE_TYPE_LABELS` (`:151-158`).

⚠ **`phaseVocabulary.ts:122-123` still claims *"Only 10 of 119 live phases carry a real
`phase.name`"*.** Refuted — corrected figures in §"Corpus" below. CONTEXT already requires this
docblock be fixed in the same edit.

### Call-site census — the asymmetry the planner must confront

**`toCanvas()` has exactly ONE production call site.** Every other reference is a test.

| Caller | File:line | Kind |
|---|---|---|
| `WorkflowCanvas` | `WorkflowCanvas.tsx:879` — `useMemo(() => toCanvas(phases, { kbTools }), [phases, kbTools])` | **production** |
| tests | `canvasModel.test.ts` (×30), `canvasModel.purity.test.ts` (×10), `canvasModel.fixtures.test.ts` (×11), `canvasModel.roundtrip.test.ts` (×1), `builderStore.test.ts` (×2), `WorkflowCanvas.test.tsx` (×2) | test |

**`nodeTitle()` has SIX production call sites:**

| Caller | File:line | Would the derived tier apply? |
|---|---|---|
| `buildPhaseData` (canvas) | `canvasModel.ts:284` | ✅ if `toCanvas` threads the context |
| `PhaseSpineGraph` | `PhaseSpineGraph.tsx:125` | ❌ **calls `nodeTitle(phase)` directly** — needs its own context prop |
| `definitionOps.canRemovePhase` | `definitionOps.ts:282` — the orphaning-delete refusal sentence | ❌ pure module, no context |
| `ProblemsTray` | `ProblemsTray.tsx:246` | ❌ mounted inside `WorkflowCanvas.tsx:1383` |
| `WorkflowBuilderPage` (add announcement) | `WorkflowBuilderPage.tsx:985` | ❌ |
| `WorkflowBuilderPage` (remove announcement) | `WorkflowBuilderPage.tsx:1025` | ❌ |

**Consequence:** unless the planner threads the context to all six, a step whose derived face reads
*"Run the pricing policy check"* on the canvas will be announced as *"Work out how to do it"* by the
screen-reader live region, and named *"Work out how to do it"* in the Problems tray and in the
delete-refusal sentence. SPEC's acceptance bar only requires the **canvas and the spine** to agree,
so the minimum is 2 of 6 — but a plan should decide the other four deliberately, not by omission.
`ProblemsTray` and both `WorkflowBuilderPage` sites are cheap (all three sit in components that
already hold the maps); `definitionOps.canRemovePhase` is a pure module whose signature would have
to widen.

**"Renders byte-identically when the param is omitted" is checkable**, because:
- `toCanvas(phases)` with no options is exercised by ~55 test assertions including a
  `toMatchSnapshot()` at `canvasModel.fixtures.test.ts:86`;
- `phaseVocabulary.test.ts:115-151` pins `nodeTitle`'s three current tiers plus its totality
  contract (an unknown `phase_type` returns the raw string, a malformed phase does not throw).

### Where the id→name maps actually live

⚠ **CONTEXT's citation is one level off.** `PhaseFormPanel.tsx:121-128` is the **prop declaration**
(`folderName?`, `folderNames?: IdNameMap`, `skillNames?: IdNameMap`) — the maps are **built by the
parent**:

```typescript
// Source: frontend/src/pages/WorkflowBuilderPage.tsx:1107-1133 (shipped, Phase 103-ux)
useEffect(() => {
  let cancelled = false
  void (async () => {
    try {
      const folders = await listFolders()
      if (cancelled) return
      const map: IdNameMap = {}
      for (const f of folders) map[f.id] = f.name
      setFolderNames(map)
      setFolderOptions(folders.map((f) => ({ id: f.id, name: f.name })))
    } catch { /* non-fatal — the panel falls back to the raw id */ }
    try {
      const skills = await listSkills()
      if (cancelled) return
      const map: IdNameMap = {}
      for (const s of skills) map[s.id] = s.name
      setSkillNames(map)
    } catch { /* non-fatal */ }
  })()
  return () => { cancelled = true }
}, [])
```

State declared at `:587` / `:589`; consumed by `PhaseFormPanel` at `:1782-1783`. **Both graph views
are mounted by this same component** — `WorkflowCanvas` at `:1516`, `PhaseSpineGraph` at `:1544` —
so no second fetch is needed. ✅ D-187-05's reuse premise holds.

### The template filename — a genuine gap

`AssetRef` (`harness.py:255-259`): `{asset_id, filename, kind: Literal["template","reference"], mime}`.
`WorkflowDefinition.assets: list[AssetRef] | None = None` (`:279`).

⚠ **Grep over `frontend/src` returns ZERO references to `assets`.** The builder does not read them
today. It *does* carry them: `DefinitionMeta` (`builderStore.ts:178-180`) is a key-remapped mapped
type over `BuilderDefinition`, which has an index signature — so `assets` round-trips through
`meta` untouched. **The template tier therefore needs a new (trivial) read of `meta.assets`, and it
is the only new data read in Req 1.**

Measured shape from the live DB (all three curated starters carry exactly one):

```json
"assets": [{"kind": "template",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "asset_id": "00000000-0000-0000-0000-000000000001/_library/risk-register.docx",
            "filename": "risk-register.docx"}]
```

⚠ **The template is DEFINITION-level, not phase-level.** So *"Fill Renewal Summary.pptx"* would
render on **every** phase that reaches that tier, not just the emitting one. The planner must gate
the template tier on `phase_type === "llm_emit"` (the only type whose executor resolves the bound
template — Phase 101.1 D-10/GAP-B), or the tier will make *distinct* steps identical, which is
exactly the failure SC#5 check 2 exists to catch.

### The demote hook (D-187-07) — one home, one arm unreachable

```typescript
// Source: frontend/src/components/workflows/definitionOps.ts:202-210 (shipped)
export function patchPhaseConfig(
  phases: readonly PhaseSpecJSON[], slug: string, patch: Readonly<Record<string, unknown>>,
): PhaseSpecJSON[] {
  return phases.map((p) => (p.slug === slug ? { ...p, config: { ...p.config, ...patch } } : p))
}
```

Reached from `builderStore.ts:519` ← `WorkflowBuilderPage.tsx:1223` `onPhaseChange`. This is the
**ONE** config-edit home; its sibling `setPhaseGovernance` (`:237-243`) is the PhaseSpec-level
writer (`grounding_escalated` / `action_risk_armed` only, type-narrowed so widening it is a
typecheck error). The demote belongs in `patchPhaseConfig`.

⚠ **The template arm of D-187-07 is unreachable today.** There is no per-phase or per-definition
template-edit surface in the builder (zero `assets` references). A demote-on-template-change test
would be testing a code path a user cannot trigger. Implement the *justification* (D-187-07's rule)
but test it at the pure-function level only, and record that the arm is currently dormant.

---

## The ⌥ reveal — measured shape of both views (Req 4)

### The canvas card — Req 4 is structurally satisfiable

```tsx
// Source: frontend/src/components/workflows/PhaseNode.tsx:140-207 (shipped)
function PhaseNodeImpl({ data, selected }: NodeProps<PhaseCanvasNode>) {
  const technical = data.technical === true
  const title = technical ? data.technicalTitle : data.title   // ← the swap Req 4 moves
  // …
  return <PhaseNodeCard slug={…} phaseType={…} icon={…} title={title}
                        subtitle={data.subtitle} tint={tint} badges={badges}
                        verdict={verdict} grounded={data.grounded} selected={selected}
                        anchors={<EdgeAnchors />} />
}
```

```tsx
// Source: frontend/src/components/workflows/PhaseNodeCard.tsx:317-331 (shipped)
<p className="truncate font-headline text-[14px] font-semibold leading-tight text-foreground">
  {title}
</p>
{subtitle ? (
  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
) : null}
{technicalLine ? (
  <p … className="mt-1 truncate font-mono text-[10px] leading-snug text-muted-foreground">
    {technicalLine}
  </p>
) : null}
```

✅ **The title IS `truncate`; the subtitle is NOT** (`leading-snug`, wraps). Sketch 149's truncation
finding reproduces structurally, and the fix works: moving `technicalTitle` into the subtitle slot
puts the full slug in the DOM with no ellipsis, exactly as SPEC's acceptance requires.

✅ **No new `PhaseNodeData` key is needed.** `technicalTitle` already rides on `data`
(`canvasModel.ts:285`). The change is `title = data.title` and
`subtitle = technical ? data.technicalTitle : data.subtitle` — **inside the adapter only**, so
`toCanvas`'s projection (and therefore `canvasModel.fixtures.test.ts:86`'s snapshot and the
committed node `data` objects) is untouched.

✅ **`PhaseNodeCard.tsx` is not modified.** Its two hard invariants (max-2 `BadgeSlots` tuple union
at `:148`; no focusable control, `:50`) are respected by construction. `technicalLine` stays unpassed
(`PhaseNode.tsx:183` keeps its reservation comment).

### ⚠ The vertical spine has NO subtitle slot — Req 4's "both views" can only mean the TITLE

Measured `PhaseSpineGraph.tsx:157-190`. Each node renders:

| Element | Line | Content |
|---|---|---|
| glyph | `:174-176` | 3D phase mark |
| `data-testid="node-title"` | `:177-182` | `title` — `truncate text-[13px]` |
| **a mono chip** | **`:183-185`** | **`{phase.config.phase_type}` — the RAW type, unconditional, reveal-OFF included** |
| **a second line** | **`:187-189`** | **`phase_index {phase.phase_index}` — raw, unconditional** |
| `aria-label` | `:164` | `` `Phase ${i+1}: ${title} (${phase.config.phase_type})` `` — raw type again |

There is **no `PHASE_TYPE_SUBTITLES` consumer anywhere in `PhaseSpineGraph.tsx`.** Two consequences:

1. **Req 4's target ("the subtitle is what the reveal replaces … both graph views agree in both
   toggle states") is not implementable on the spine without adding a subtitle line to it** —
   scope growth the SPEC did not budget. The SPEC's own acceptance criterion is narrower and *is*
   satisfiable: *"The canvas and the vertical spine render the same **title** in both toggle
   states."* **Recommendation: implement the subtitle swap on the canvas only; on the spine, stop
   swapping the title (so `nodeTitle` shows in both states) and leave the existing raw chip as the
   technical affordance.** Record the asymmetry.
2. **SC#5 check 1 ("zero reveal-OFF faces contain a slug or a raw `phase_type` token") FAILS on the
   spine today, 100% of the time**, by construction — `:184` prints `llm_agent`. If "face" means
   *the rendered node*, the check can never pass without deleting shipped spine chrome. See
   §"Open Questions" Q2.

### The `?raw` source guards — they do NOT trip on this work

```typescript
// Source: frontend/src/components/workflows/PhaseSpineGraph.test.tsx:180-194 (shipped)
const src = phaseSpineGraphSource
expect(src).not.toMatch(/const PHASE_GLYPHS/)
expect(src).not.toMatch(/const PHASE_TYPE_LABELS/)
expect(src).not.toMatch(/(function|const)\s+parseSkipTarget/)
expect(src).not.toMatch(/interface (PhaseSpecJSON|PhaseConfigJSON|ValidatorJSON)/)
expect(src).not.toMatch(/lastIndexOf/)
expect(src).toMatch(/phaseVocabulary/)
expect(src).toMatch(/soulData/)
```

Plus `PhaseSpine.test.tsx:104-117` (no `PhaseTimeline` / `PhaseCard` import, no local
`PHASE_GLYPHS`, must import `soulData`).

✅ These are **negative regexes over the two spine files only**. A new derivation added to
`phaseVocabulary.ts` cannot trip them. They *would* trip if a plan declared the derivation map
locally inside `PhaseSpineGraph.tsx`. The CONTEXT's worry is discharged — but the *rule* still binds:
one home, `phaseVocabulary.ts`.

---

## Generation — what is actually wired (Req 2)

### `AUTHORING_SYSTEM_PROMPT` — the exact gap

`workflow_authoring.py:57-89`. The final instruction (`:87-88`) reads verbatim:

> *"Give each phase a short `slug` and a sequential `phase_index` starting at 0; set the definition
> `slug`, `version` (1), `name`, and `status` ('draft')."*

✅ **Confirmed: no per-phase `name` instruction.** `PhaseSpec.name` already exists
(`harness.py:206`) inside the `extra="forbid"` union, so Req 2 adds **zero schema surface** — one
sentence in a prompt string. (Note: the SPEC/CONTEXT cite `:88`; the constant *starts* at `:57`.)

**Evidence the instruction will work:** 12 phases in the live DB already carry generator-written
names despite no instruction — `"Gather new and changed SOPs"`, `"Write weekly SOP summary"`,
`"Read & analyze Meridian risk documents"`, `"Search the knowledge base"`, `"Write cited answer"`,
`"Emit risk briefing"`. The models emit `name` opportunistically because the schema advertises it.
An explicit instruction should raise this from occasional to universal.

### The provider-call budget (Req 2's third acceptance)

`workflow_authoring.py:289-320`: `_shot()` logs `nl_generation_attempt {attempt}` then calls
`forced_emit(...)`. `res1 = await _shot(base_messages, 1)`; on `wd is None`, **exactly one retry**
with the failure fed back. The docstring at `:236-238` states the contract. A prompt-text change
cannot alter this — the budget assertion is a regression guard, not a risk.

### `resolve_authoring_model` — env-only, confirmed

```python
# Source: backend/app/services/workflow_authoring.py:92-114 (shipped)
def resolve_authoring_model(settings) -> str | None:
    model = getattr(settings, "harness_authoring_model", None)
    if model:
        return model
    from app.config import get_model_capability
    for candidate in ("claude-opus-4-8", "gpt-5.5"):
        cap = get_model_capability(candidate) or {}
        if cap.get("forced_emission"):
            return candidate
    return None
```

✅ Finding 4 confirmed: `harness_authoring_model` is declared once at `config.py:1164` as
`str | None = None`, has no `app_settings` row, no Settings UI and no `load_app_settings` sync. It is
**also absent from `backend/.env.example` and `deploy/onebox.env.example`** — an undocumented env
var, which is a slightly worse defect than CONTEXT recorded. Live value: `None`.

### 🔑 The SC#10 test does NOT need a monkeypatch

`generate_workflow_definition(*, describe, supabase, user_id, **settings**, pool=None, …)` —
`settings` is a **parameter** (`:222`), and `resolve_authoring_model(settings)` is called on it at
`:243`. The route passes the module-level singleton (`api/workflows.py:1318`), but a test can pass
`SimpleNamespace(harness_authoring_model="glm-5.2")` directly. **No global mutation, no
monkeypatch, no contamination — rows could even run concurrently** (though serial is still the safer
default). This is materially cheaper than D-187-13 assumed.

**What a real `forced_emit` row still costs:** `load_user_settings(user_id)` (`:267`, blocking, hits
Supabase) for the provider key + `active_provider`, and `_assemble_grounding` (`:276`) which reads
the folder tree + skill registry. So the row needs a live Supabase and a real user id — an
integration-tier test, not a unit one. The `provider` argument is resolved from
`get_model_capability(authoring_model)["provider"]` (`:250`), so a model id absent from the registry
fails fast with `no_authoring_model`.

---

## SC#10 roster — derived live from `MODEL_CAPABILITIES`

Derived by importing `app.config.MODEL_CAPABILITIES` and grouping on `provider`
(2026-08-02, `develop` @ `132b9b26`). **Not re-typed.**

### ⚠ The SPEC's constraint block is wrong on all four counts

| SPEC claim (2026-08-01 "crude parse") | Measured 2026-08-02 |
|---|---|
| 23 models | **61 models** |
| 7 provider groups | **8 provider groups** |
| openai 7 / anthropic 2 / google 3 / moonshot 1 / minimax 3 / zhipu 2 / openrouter 5 | openai **17** / anthropic **7** / google **7** / moonshot **3** / minimax **8** / zhipu **8** / openrouter **9** / **deepseek 2** |
| "**DeepSeek did not appear** — confirm at plan time" | ❌ **DeepSeek IS present** as a native group: `deepseek-v4-flash`, `deepseek-v4-pro` |
| "**all** declaring `forced_emission: True`" | ❌ **5 models declare `forced_emission=None`** — all 3 moonshot natives + 2 openrouter moonshot rows, all `emit_tier="coerce"` |

### The 8 rows (newest registry-backed id per provider, per CLAUDE.md's rule)

| # | Provider | Suggested model id | `native_tools` | `emit_tier` | `forced_emission` | `strict_json_schema` | Key configured | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | openai | `gpt-5.6-sol` | True | `force_strict` | True | True | ✅ | runnable |
| 2 | anthropic | `claude-sonnet-5` | True | `force` | True | — | ✅ | runnable |
| 3 | google | `gemini-3.5-flash` | True | `force` | True | — | ✅ | runnable |
| 4 | **deepseek** | `deepseek-v4-pro` | True | `force` | True | True | ✅ | runnable — **the row the SPEC said did not exist** |
| 5 | zhipu | `glm-5.2` | True | `force` | True | — | ✅ | runnable |
| 6 | minimax | `MiniMax-M3` | True | `force` | True | — | ✅ | runnable |
| 7 | **moonshot** | `kimi-k2.6` | True | **`coerce`** | **`None`** | — | ✅ | runnable — **the weakest emission guarantee; expect this row to fail first** |
| 8 | openrouter | `z-ai/glm-5.2` | **False** | `force` | True | — | ✅ | runnable — the non-native tool path |

**All 8 provider API keys are configured in the local environment** (verified as booleans only —
no secret values were read). ⇒ **zero ⛔ rows expected from missing keys.**

⚠ **The moonshot row is the interesting one and must not be dropped.** `forced_emission` is `None`,
so `resolve_authoring_model`'s *fallback* would never select a moonshot model — but an explicit
`harness_authoring_model="kimi-k2.6"` bypasses the fallback entirely and hands an unforceable model
to `forced_emit(schema_model=WorkflowDefinition)`. If that row fails, it is a **real finding about
the knob**, not a broken test: it means `resolve_authoring_model` validates the fallback but not the
explicit setting. Record the outcome either way; never silently omit the row.

**Note on `strict_json_schema`:** irrelevant here — `generate_workflow_definition` calls
`forced_emit(..., strict=False)` deliberately (Pitfall 1: strict ON 400s on the optional-heavy
schema for OpenAI/DeepSeek).

---

## D-187-11 — the `/validate` seam

### Exact line numbers (measured 2026-08-02)

| Symbol | Line | Note |
|---|---|---|
| `class Verdict` | `306-322` | `code`/`phase`/`message`/`severity: Literal["error","incomplete"]` |
| `class ValidateResponse` | `325-336` | `ok == (verdicts == [])`; an `incomplete`-only set still sets `ok False` |
| `kb_tools: list[str]` on the bundle response | `402` | |
| `_ROUTE_ASSIGNED_CODES` | `464-470` | `{"business_requirement", "interactive_phase"}` |
| `_INCOMPLETE_CODES` | `473-479` | `{"input_unsatisfied", "business_requirement", "interactive_phase"}` |
| `_KNOWN_CODES` | `492-494` | `LINT_CODES ∪ GROUNDING_VERDICT_CODES ∪ _ROUTE_ASSIGNED_CODES ∪ _DEGRADED_CODES` |
| `_ERROR_CODES` | `499` | **derived**: `_KNOWN_CODES − _INCOMPLETE_CODES − _DUAL_SOURCE_CODES` |
| `def _severity` | `502-540` | **fails LOUD** to `"error"` + a logged warning on an unrecognised code |
| `@router.post("/validate")` | `542-546` | `require_canvas()` alone |
| the four aggregated stages | `607-667` | lint → grounding_verdicts (sealed) → business_requirement → `_interactive_phase_failures` |
| verdict assembly | `669-679` | `severity=_severity(f["code"], phases_empty=…)` |
| `kb_tools=bundle.kb_tools` | `745` | on `GET /grounding-bundle` |
| `@router.post("/generate")` | `1288-1292` | `require_visible("workflow_authoring")`, returns `{ok, definition}` only — **no verdict** ✅ D-187-08's premise |

### Two placements, two blast radii

**Option A — mint it in the route** (the `interactive_phase` precedent). Add the code to
`_ROUTE_ASSIGNED_CODES` **and** `_INCOMPLETE_CODES`, and emit it in `validate_workflow` between
stages 3 and 4 from the same `KB_TOOLS` intersection `grounding_cause` uses.
- Blast radius: `/validate` only. Publish behaviour unchanged.
- Does it still achieve D-187-11's goal? **Yes** — `blockedReason`
  (`WorkflowBuilderPage.tsx:1093-1102`) returns a non-null reason for *any* `ok:false`, including an
  `incomplete`-only set, so the canvas Publish button is blocked before a golden run can be spent.

**Option B — add it to `grounding.grounding_verdicts`** (`grounding.py:666-729`).
- ⚠ **`grounding_verdicts` is SHARED WITH PUBLISH.** Plan 182-06 made publish *enforcing* for
  grounding fidelity through this same collector. A check added here becomes a **hard publish
  blocker** on the server, not just a canvas verdict.
- It would also need registering in `grounding.GROUNDING_VERDICT_CODES` (`:492-498`) **and**
  `workflows._INCOMPLETE_CODES` — because `_ERROR_CODES` is *derived* by subtraction, a new
  `GROUNDING_VERDICT_CODES` member lands in the **error** bucket automatically.
- `test_182_severity_codes.py` scans `grounding.py` with `_VERDICT_EMIT_RE =
  re.compile(r'"code":\s*"([a-z_]+)"')` (whole-line `#` comments stripped) and **fails if a literal
  emit site is not in the published set**. So the registration is machine-enforced.

**Recommendation: Option A.** It is smaller, keeps publish behaviour unchanged (this phase is not
scoped to change what publishes), and matches the shipped precedent for a route-minted finding. If
the operator wants publish to block too, that is a separate, explicit decision.

**Hard requirement either way:** register the new code, or `_severity` will log a warning on every
canvas edit and classify it `"error"` instead of `"incomplete"` — the opposite of D-187-11.

### The tool intersection is already one home

```python
# Source: backend/app/services/harness/grounding.py:797-803 + :806-840 (shipped)
KB_TOOLS: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "analyze_document", "get_related_documents",
})
KB_TOOLS_SORTED: list[str] = sorted(KB_TOOLS)

def grounding_cause(phase) -> str | None:
    if set(getattr(phase.config, "available_tools", None) or ()) & KB_TOOLS:
        return "detected"
    if getattr(phase.config, "citation_policy", None) == "strict":
        return "already-set"
    if getattr(phase, "grounding_escalated", False):
        return "escalated"
    return None
```

The new check reads exactly this — `grounding_cause(phase) == "detected"` **and**
`wd.project_folder_id is None`. Pure, zero I/O, no pool (the docstring says so explicitly). It
therefore belongs *outside* the sealed try/except block at `workflows.py:614-644`, alongside lint
and `business_requirement`, which is another reason Option A is the natural placement.

---

## The seed receipt — the data path (Req 5)

| Input | Source | Available where the receipt mounts? |
|---|---|---|
| step count + per-step face | `phases` (store) | ✅ |
| per-step grounding cause | `groundingCauseOf(phase, kbTools)` (`phaseVocabulary.ts:297`) | ✅ |
| `kbTools` | `useGroundingBundle(canvasEnabled)` → `WorkflowBuilderPage.tsx:853`, `:872-875` | ✅ |
| "a fresh draft just arrived" | `onDraft` success at `:1186` (`store.getState().setDrafted(def)`) | needs one new page state flag |

⚠ **`useGroundingBundle` is called with `canvasEnabled` (`:853`).** With the canvas flag OFF,
`kbTools` is `[]` and `groundingCauseOf` returns `null` for every step — the receipt would claim
*zero* grounded steps on a workflow that will be gated at run time. **The receipt MUST be gated on
`canvasEnabled`**; showing it flag-off would be actively misleading, not merely out of scope.

⚠ **`onDraft` is also reachable from the `autoDraft` path** (`:1202-1216`, the Phase-124 CR-01
"Describe & run" door hand-off). The receipt would appear there too. That is arguably correct — it
*is* a fresh AI seed — but it is a surface the phase did not scope. Decide it.

**D-187-09's in-memory dismissal** maps cleanly: a page-level `showSeedReceipt` boolean set `true`
in `onDraft`'s success branch and `false` on dismiss. Nothing to key on and nothing to clean up —
which is exactly why D-187-09 rejected persisting per draft id (there is no id at generation time;
`setDraftId(null)` runs at `:1173`).

---

## The template door (Req 6 / VOCAB-03)

### The starters feed — already shipped end to end

- Route: `GET /workflows/starters` (`api/workflows.py:223-224`) — a documented **RUN CARVE-OUT**,
  deliberately **not** gated by `require_visible` or `require_canvas` (`:171`).
- DB: `list_starter_workflows` (`db/workflows.py:291-317`) —
  `status='published' AND is_system_global=true AND definition->>'category'='starter'`, returns
  `id, slug, name, definition`.
- Client: `listStarterWorkflows(signal?)` (`api.ts:1363-1365`).
- ✅ **Measured live: exactly 3 curated starters**, each 2 phases:

| Starter | slug | spine | assets |
|---|---|---|---|
| Compliance Gap Report | `compliance-gap-report` | `llm_agent` (`retrieve`, tools `["search_documents"]`) → `llm_emit` (`emit`) | 1 template `.docx` |
| Risk Register | `risk-register` | same | 1 template `.docx` |
| Weekly Status Report | `weekly-status-report` | same | 1 template `.docx` |

None of the 6 phases carries a `name`, a `skill_ref` or a `folder_scope`. **All three starters
therefore render the identical spine and, today, the identical two faces**
(`"Work out how to do it"` → `"Produce the deliverable"`). The template tier (`llm_emit`-gated)
would give each starter a distinct second face (`"Fill risk-register.docx"` etc.) — which is a good
demonstration of Req 1 and also the reason the picker rows must show the **spine**, per
icon-convention §4 / finding #36, since the spines are identical and only the names differ.

### ⚠ D-181-01 hazard — the describe screen renders on BOTH flag branches

`WorkflowBuilderPage.tsx:1403-1495` builds `describeScreen`; the only flag-dependent difference is
whether it is wrapped in a `BuilderHeaderBar` (`:1483-1493`, `preDraftHeaderHosted`). The `<textarea>`
(`:1416-1424`), the project picker (`:1430-1448`), the CTA (`:1450-1458`) and the
`data-testid="describe-hint"` line (`:1459-1464`) are shared.

**So Req 6's "one quiet line under the CTA" would appear with `visual_workflow_canvas` OFF unless it
is gated on `canvasEnabled`.** There is **no** byte-identical test pinning the describe screen —
only `FLAG_OFF_HEADER_MARKUP` in `WorkflowBuilderPage.header.test.tsx:302-322` covers the header —
so this regression would be **silent**. **Recommendation: gate the door on `canvasEnabled`** (the
183–186 precedent) and add a flag-off assertion so it cannot regress.

**The seam Req 6 reuses:** the picker sets local `describe` state (`:558`, `setDescribe` at `:1419`),
not the `initialDescribe` prop — which is an *upstream* hand-off prop (`:512`, from the Phase-124
"Describe & run" door), not settable from inside the page. CONTEXT's phrasing ("the picker only
needs to set that text") is right in substance; the mechanism is `setDescribe`, not `initialDescribe`.

---

## Corpus — the SC#5 measurement, honestly split

Measured live on :54322, 2026-08-02.

```
jsonb_typeof(definition):  object → 27 rows      string → 145 rows      (172 total)
rows with a top-level 'phases' key: 27
```

| Layer | Rows | Phases | Non-empty `name` | Workflows with ≥2 identical reveal-OFF faces |
|---|---|---|---|---|
| **Raw `object` rows — the only ones any app read path can parse** | 27 | **57** | **0** | **1** (`plan_execute_verify`) |
| `string` rows, after one extra `json.loads` unwrap (unreadable by `WorkflowDefinition.model_validate()`, which would 422 on a `str`) | 145 | 153 | **12** | 1 (`dba-research-stat-summary-docx-…`) |

✅ **The SPEC's headline "0 of 57 across 27 well-formed rows (145 double-encoded)" REPRODUCES
exactly.** Both the sketch's "10 of 119" and my first-pass "12 of 210" are artefacts of reading at
the wrong depth. Use **0 of 57** for the app-visible claim and note the 12 as evidence for Req 2.

Other measured facts: max phases per workflow = **5**. Type histogram over all 210 unwrapped phases:
`llm_agent` 103, `llm_emit` 72, `llm_single` 23, `llm_human_input` 6, `llm_batch_agents` 3,
`programmatic` 3. Status split: 71 draft, 58 published (private), 43 published + `is_system_global`.

### 🚨 SC#5 check 2 is UNSATISFIABLE over the named corpus

The corpus is *3 curated starters + 4 canonical seeds (`four_seed_defs()`) + the PM pack*. The
single HEAD failure is `plan_execute_verify`, and its shape (verified verbatim at
`backend/tests/conftest.py:867-890`) is:

| # | slug | `phase_type` | config beyond `prompt` | reveal-OFF face TODAY | derived tier (D-187-04) |
|---|---|---|---|---|---|
| 0 | `plan` | `llm_single` | *(none)* | `"Write it up"` | **null** — no skill, no template, no folder, not human input |
| 1 | `execute` | `llm_agent` | `available_tools: [search_documents, execute_code]` | `"Work out how to do it"` | **null** (unless a tools-based tier is added) |
| 2 | `verify` | `llm_single` | one `regex_match` validator | `"Write it up"` | **null** |

**Phases 0 and 2 are indistinguishable to the D-187-04 derivation.** They have no `skill_ref`, no
template, no `folder_scope` and are not `llm_human_input`. The derived tier resolves to `null` for
both, so both fall through to `PHASE_TYPE_SENTENCES["llm_single"]` and **still render `"Write it
up"` twice after this phase ships.** And because `plan_execute_verify` is a migration-061 seed, not
generator-authored, Req 2 (per-step names) can never fill its `name` either.

The other three seeds pass: `research_summarize` (agent→single), `literature_review`
(programmatic→batch→single), `doc_qa_human` (agent→human_input→single) all have distinct types per
step. The 3 curated starters pass. So the check fails on **exactly one** corpus member, permanently.

**This must be resolved at plan time.** Options, cheapest first:
1. **Narrow the check** to *"no two steps with materially different config render identical
   faces"* — i.e. two bare `llm_single` steps that differ only in `prompt` are *honestly* the same
   kind of step, and a face that says so is not a defect. This is defensible and testable.
2. **Narrow the corpus** — run check 2 over the 3 starters + the PM pack + generated definitions,
   and record `four_seed_defs()` as a known, documented exception with the reason.
3. **Add a tier** the derivation can see (e.g. a prompt-derived verb). Rejected on sight: it is a
   fabrication risk and D-187-05's floor forbids inventing a name.
4. Give the seeds names — a data change, and migrations are out of scope.

**Recommendation: option 1, with option 2's exception list as the fallback.** Either way, the SPEC's
"this check FAILS on HEAD today" should be re-stated precisely: *it fails on 1 of 27 readable
workflows and on 1 of the 4 canonical seeds*.

---

## Common Pitfalls

### Pitfall 1: The name maps arrive asynchronously — the face will pop in
**What goes wrong:** `folderNames`/`skillNames` are fetched in a `useEffect` on mount
(`WorkflowBuilderPage.tsx:1107-1133`). On first paint they are `{}`, so every derived tier misses
and every node renders its type sentence; when the fetch resolves, faces change under the user.
**Why it happens:** D-187-05's never-fabricate floor makes an empty map indistinguishable from "no
binding", which is the right safety choice and the wrong loading choice.
**How to avoid:** decide it deliberately. Either accept the settle (it matches how the panel already
behaves — `PhaseFormPanel` shows the raw id until the map lands), or hold the derived tier until
`folderNames`/`skillNames` are non-empty. Do **not** invent a placeholder.
**Warning signs:** a UAT observer says "the names changed by themselves" on a slow connection.

### Pitfall 2: A definition-level template on every phase
**What goes wrong:** `assets` lives on the definition, not the phase. An ungated template tier
renders `"Fill risk-register.docx"` on **all** phases that reach it, making distinct steps identical
— the exact failure SC#5 check 2 exists to catch.
**How to avoid:** gate the template tier on `phase_type === "llm_emit"`.
**Warning signs:** a 5-step workflow where three faces read the same filename.

### Pitfall 3: The armed reading widened to the whole phase
**What goes wrong:** replacing `_is_action_risk_finding(error_message)` with
`phase.action_risk_armed` inside `_resolve_failure_with_ask_user` gives an author's unrelated
freshness `ask_user` gate the indefinite wait, the shutdown escape and the exact-match approval
allow-list.
**Why it happens:** D-187-03's "exactly ONE reading" is right about the *trigger* and reads as if it
also applies inside the pause helper.
**How to avoid:** an explicit keyword-only `is_action_risk: bool = False` parameter.
**Warning signs:** `test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped` (`:683`) or
`test_non_armed_free_text_fall_through_is_unchanged` (`test_ask_user_disposition.py:599`) goes red.

### Pitfall 4: `_failing_on_failure` silently routes the hoisted checkpoint away from the pause
**What goes wrong:** `_resolve_failure_with_ask_user:979` resolves the disposition from
`phase.validators[failed_idx]`. With no armed spec in the list, `failed_idx` is `None` and the
disposition falls back to the phase's own heuristic — which may be `fail_run`, so the checkpoint
routes to `_route_on_failure` and the person is never asked. **This is a fail-open of exactly the
class 185's BLOCKER T-185-04-01 belonged to.**
**How to avoid:** short-circuit the disposition resolution when `is_action_risk` is True. Make the
property test cover a phase with author validators declaring `on_failure: "fail_run"`.

### Pitfall 5: Full-suite frontend numbers used as a gate
**What goes wrong:** the full vitest run reports 42–49 failures **and the number moves run to run**.
`WorkflowCanvas.test.tsx` (2 failures) and `PublishGauntlet.test.tsx` (22 failures) fail only in the
full run — both are **100% green in isolation**. A plan that gates on "full suite green" can never
pass; one that gates on "no new failures" will chase flake.
**How to avoid:** gate on a **named isolated set** with a required non-decreasing count. Record the
full-suite number as a flaky range, never as pass/fail.
**Warning signs:** two runs of the same commit reporting different failure counts (measured: 42 then
49, both at `132b9b26`).

### Pitfall 6: A new `harness_audit` event type
**What goes wrong:** the CHECK constraint is a closed list of 23 values; an unlisted
`event_type` raises and — per `BUG-260731-02` (folded into 185) — **killed the run**.
**How to avoid:** the hoisted checkpoint reuses `action_risk_pending` and
`validator_ask_user_approved`. Both are already in the constraint (verified).

### Pitfall 7: `--reporter=basic` on vitest 4.1
Fails with `Failed to load url basic (resolved id: basic)`. Use the default reporter, or
`--reporter=json --outputFile=<path>` for machine-readable output.

### Pitfall 8: The template door leaking to the flag-off first screen
Covered above. No shipped test pins the describe screen, so the D-181-01 regression is silent.

---

## Code Examples

### The three-tier resolution (the shape to write)

```typescript
// Target shape for phaseVocabulary.ts — mirrors the shipped groundingCause/groundingCauseOf pair
export interface NameContext {
  /** folder id → display name (WorkflowBuilderPage.tsx:1113-1115). Absent/empty ⇒ no folder tier. */
  folderNames?: Readonly<Record<string, string>>
  /** skill id → display name (WorkflowBuilderPage.tsx:1123-1125). */
  skillNames?: Readonly<Record<string, string>>
  /** definition.assets[] where kind === "template" → filename. llm_emit ONLY (Pitfall 2). */
  templateFilename?: string
}

const NO_NAME_CONTEXT: NameContext = Object.freeze({})   // the NO_KB_TOOLS idiom

export function nodeTitle(phase: PhaseSpecJSON, ctx: NameContext = NO_NAME_CONTEXT): string {
  const name = phase.name?.trim()
  if (name) return name                       // tier 1 — stored (author or seeded)
  const derived = derivedFaceOf(phase, ctx)   // tier 2 — NEW, D-187-04 precedence
  if (derived) return derived
  const type = phase.config.phase_type
  return PHASE_TYPE_SENTENCES[type] ?? type   // tiers 3 + 4 — unchanged
}
```

### The reveal swap (Req 4, canvas)

```tsx
// PhaseNode.tsx:143-144 — before
const technical = data.technical === true
const title = technical ? data.technicalTitle : data.title
// …
<PhaseNodeCard title={title} subtitle={data.subtitle} … />

// after — no new data key, no projection change, snapshot untouched
const technical = data.technical === true
// …
<PhaseNodeCard
  title={data.title}
  subtitle={technical ? data.technicalTitle : data.subtitle}
  … />
```

### The armed checkpoint (the shape, per D-187-01/02 + the parameter finding)

```python
# harness_engine.py — inserted between :739 (the old fall-through comment) and :741
# The guarantee is a PROPERTY of the phase, not a position in a list (SPEC Req 7).
if getattr(phase, "action_risk_armed", False):
    from app.services.harness.grounding import _approval_sentence
    sentence = _approval_sentence(phase, total_phases)      # NOTE: total_phases must be threaded in
    await write_audit(pool, run_id, user_id=_audit_user_id,
                      event_type="action_risk_pending",     # already in the CHECK constraint
                      metadata={"phase": phase.slug, "timing": "pre"})
    await _emit(redis, stream_run_id, "action_risk_pending", phase=phase.slug)
    outcome = await _resolve_failure_with_ask_user(
        phase, _ACTION_RISK_FINDING_PREFIX + sentence, 0, None,
        run_id=run_id, pool=pool, redis=redis, ctx=ctx,
        _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
        is_pre=True,
        is_action_risk=True,          # ← EXPLICIT. Never read off the phase inside that helper.
    )
    if outcome is not None:
        return outcome                # refusal / abort / unreadable answer → the body never runs
    # approved → fall through to the body
```

⚠ **`total_phases` is not currently in `_run_phase_with_gates`'s scope.** It is only in
`run_workflow` (`:1338`, `_total = len(definition.phases)`). Threading it is a signature change on a
function with many unit callers — the planner must plan for it (an optional keyword with a safe
default keeps existing direct unit callers valid).

### The `/validate` verdict (Option A shape)

```python
# api/workflows.py — stage 3.5, alongside business_requirement (pure, no I/O, outside the seal)
if body.project_folder_id is None:
    for phase in body.phases:
        if grounding.grounding_cause(phase) == "detected":
            findings.append({
                "code": "unbound_retrieval",          # add to _ROUTE_ASSIGNED_CODES *and*
                "phase": phase.slug,                  #        _INCOMPLETE_CODES, or _severity
                "message": (                          #        fails LOUD to "error"
                    f"phase '{phase.slug}' reads your documents but this workflow is not "
                    "bound to a knowledge base — it would search everything"
                ),
            })
```

---

## State of the Art

| Old approach (in this repo) | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| A three-face grounding word-badge in card slot 1 | The shape-only corner seal `⛨`; slot 1 deliberately empty and reserved for 188/189 | Phase 185 (`PhaseNode.tsx:160-181`) | Do not add a badge for anything in this phase |
| The spine declared its own glyph map, type labels, read shapes, skip parse and title resolver | All six live in `phaseVocabulary.ts` / `soulData.ts`, enforced by `?raw` guards | Phase 183-04 ("the hard cut") | The derived tier has exactly one legal home |
| `/validate` classified unknown codes as the soft `incomplete` (fail-open) | `_severity` fails LOUD to `error` + logs the code; known sets DERIVE from owning modules | Phase 182 gap-closure (WR-05) | A new code MUST be registered or it is mis-classified and noisy |
| `_is_abort_choice` (a deny-list) decided armed approval | An exact-match ALLOW-LIST on the presented label (`:1194`) | Phase 185 BLOCKER T-185-04-01 | Must survive the hoist untouched — it is the fail-open fix |
| Publish's grounding gate was advisory | Publish is **enforcing** through the same `grounding_verdicts` collector | Plan 182-06 | Why D-187-11 Option B has publish blast radius |
| `action_risk_pending` was not in the `harness_audit` CHECK | It is (23 values) | Phase 185 (`BUG-260731-02`) | Zero-migration constraint is satisfiable |

**Deprecated / outdated in the source itself:**
- `phaseVocabulary.ts:122-123` — *"Only 10 of 119 live phases carry a real `phase.name`"*. **Refuted
  (0 of 57).** Fix in the same edit (CONTEXT already requires this).
- `themes/canvas-184.css` — 137-D geometry (left-floating icon, 300px card). The shipped card is
  137-B. Never reason about the card from it.
- ROADMAP's `grounding.py:951-953` citation for the armed append — the append is `:920-933`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Removing the `"action_risk_approval"` Literal is safe because **0 of 172 local rows** name it — but the **cloud** database was not and cannot be measured from here | SC#6 → Literal verdict | A cloud row naming it would fail `model_validate()` on every read. **Mitigated by the recommendation to KEEP it**, which makes the risk moot. |
| A2 | `gpt-5.6-sol` / `claude-sonnet-5` / `gemini-3.5-flash` / `MiniMax-M3` / `glm-5.2` / `kimi-k2.6` / `deepseek-v4-pro` / `z-ai/glm-5.2` are the *newest* per group | SC#10 roster | Ordering by name is a heuristic; the registry has no date field. A wrong pick still exercises the provider. Re-derive at plan time; never re-type. |
| A3 | All 8 provider keys being non-empty means all 8 rows will actually complete a `forced_emit` | SC#10 roster | A key may be expired/quota-limited. Rows are ⛔-recordable, never omitted. |
| A4 | The moonshot row (`forced_emission=None`, `emit_tier=coerce`) will be the first to fail | SC#10 roster | If it passes, no harm. If it fails it is a real finding about `resolve_authoring_model` not validating the explicit setting. |
| A5 | Gating the template door on `canvasEnabled` is the operator's intent | Template door | If the operator wants it flag-off too, D-181-01 byte-identity is broken and needs an explicit override. Surface at plan time. |
| A6 | The full-suite frontend flake (42 vs 49) is parallel-worker interference, not a real intermittent bug | Pitfall 5 | If it is a real race, a plan gating on isolation could mask it. Both files are green in isolation, matching 186-15's documented pattern. |
| A7 | `harness_authoring_model` has no cloud `app_settings` counterpart either | Env vars | Grep covered `backend/app`, `frontend/src`, `supabase/migrations`, `backend/.env.example`, `deploy/onebox.env.example` — 1 hit total (the field declaration). Low risk. |

---

## Open Questions (RESOLVED)

> **All 7 were closed at the plan-phase touchpoint (2026-08-02).** The questions and their measurements
> are left verbatim — the measurement in each one IS the record, and re-writing it would destroy the
> evidence a later phase needs. Each carries a one-line resolution pointer to the decision or plan that
> settled it. Nothing below is still open.

1. **SC#5 check 2 cannot pass over the named corpus.** *(highest priority)*
   - What we know: `plan_execute_verify`'s `plan` and `verify` are both bare `llm_single` steps
     whose only differing field is `prompt`. The D-187-04 derivation reads none of that, so both
     resolve to `null` and both fall through to `"Write it up"`. Verified verbatim at
     `backend/tests/conftest.py:867-890`. The other 3 seeds and all 3 starters pass.
   - What's unclear: whether the operator considers two bare `llm_single` steps rendering the same
     face a *defect* or an *honest statement*.
   - Recommendation: **narrow the check** to "no two steps with materially different config render
     identical faces", and record `plan_execute_verify` as the documented exception with its
     measured shape. Do not add a prompt-derived tier (fabrication risk, D-187-05's floor).
   - → **RESOLVED by D-187-15** — the operator took the narrowing verbatim ("no two steps with
     *materially different config* render identical faces") and recorded `plan_execute_verify` as the
     documented exception with its measured shape. A prompt-derived tier was explicitly rejected.
     Implemented in **plan 187-12** (`phaseVocabulary.corpus.test.ts`).

2. **What is a "face" for SC#5 check 1?**
   - What we know: `PhaseSpineGraph.tsx:184` prints the raw `phase.config.phase_type` in a mono chip
     and `:187-189` prints `phase_index {N}` — both unconditional, reveal-OFF included. `:164`'s
     `aria-label` also carries the raw type. If "face" means the rendered node, check 1 fails 100%
     on the spine today and can only pass by deleting shipped chrome.
   - Recommendation: define "face" as **the string `nodeTitle()` returns** (plus the canvas card's
     subtitle), and test it as a pure-function assertion over the corpus rather than a DOM scrape.
     That is deterministic, cheap, and matches what Req 1 actually changes.
   - → **RESOLVED by D-187-16** — "face" = the string `nodeTitle()` returns, plus the canvas card's
     subtitle; SC#5 check 1 is a **pure-function assertion over the corpus**, not a DOM scrape.
     Stripping the spine's pre-existing raw chrome was rejected. Implemented in **plan 187-12**.

3. **Does Req 4's "both graph views agree" require a subtitle on the spine?**
   - What we know: the spine has no `PHASE_TYPE_SUBTITLES` consumer. The SPEC's own acceptance
     criterion says *"the same **title** in both toggle states"*, which is satisfiable without one.
   - Recommendation: canvas gets the subtitle swap; the spine simply stops swapping its title.
     Record the asymmetry rather than growing scope.
   - → **RESOLVED by D-187-16** (same decision, second half) — **no**. The canvas gets the subtitle
     swap; the spine simply stops swapping its title, and the asymmetry is recorded rather than
     designed away. Adding a `PHASE_TYPE_SUBTITLES` consumer to the spine was rejected. Implemented in
     **plan 187-09**.

4. **Where exactly does the armed checkpoint sit relative to the retry loop?**
   - What we know: the body is at `:747` inside `while True:` at `:743`. Inside ⇒ one prompt per
     retry attempt; before ⇒ one per phase execution.
   - Recommendation: **before** the loop (matching the once-per-phase pre-gate pass). Neither SPEC
     nor CONTEXT settles it.
   - → **RESOLVED by D-187-17** — **before** the `while True:` at `harness_engine.py:743`. One prompt
     per phase execution; a retry after a failed attempt does not re-ask. Inside the loop was rejected
     (a 3-retry phase would ask three times). Implemented in **plan 187-06**, proved by the plan
     187-01 property and re-verified in **187-11**.

5. **Should the receipt appear on the `autoDraft` hand-off path?**
   - What we know: `onDraft` is reachable from `:1202-1216` (the Phase-124 "Describe & run" door).
   - Recommendation: yes (it is a genuine AI seed), but state it so it is not discovered in UAT.
   - → **RESOLVED — Claude's Discretion**, decided **yes** and stated in **plan 187-15 Task 2**'s action
     and `<behavior>` (with an acceptance criterion asserting the receipt appears after an
     `autoDraft`-driven draft), precisely so it is not discovered in UAT. Both paths funnel through
     `onDraft`'s success branch, so it costs no extra line.

6. **How many of the six `nodeTitle()` call sites get the name context?**
   - Recommendation: at minimum canvas + spine (SPEC's bar). `ProblemsTray` and both
     `WorkflowBuilderPage` announcement sites are cheap and prevent a screen-reader/tray disagreement.
     `definitionOps.canRemovePhase` needs a signature widening — decide deliberately.
   - → **RESOLVED — Claude's Discretion, decided FIVE of six.** Canvas + spine in **plan 187-15 Task 1**
     (the SPEC floor); `ProblemsTray` in **plan 187-08 Task 2** — measured: the tray is mounted at
     `WorkflowCanvas.tsx:1383`, *inside* a file that plan already touches, so it costs **one prop line
     and zero lines in the D-187-14-gated page**; both `WorkflowBuilderPage` announcement sites
     (`:985`, `:1025`) in **plan 187-15 Task 1**, budgeted as component 4 of that plan's derived diff
     cap (5 ins / 4 del). **`definitionOps.canRemovePhase` is DEFERRED by name** — widening a pure
     module's signature is a separate decision and its refusal sentence is a shape predicate, not a
     node face. Its consequence (a refusal notice naming a step differently from the `Added`/`Removed`
     notices beside it) and its **re-open trigger — Phase 188's `WorkflowCanvas.tsx` extraction** — are
     recorded in `187-VALIDATION.md`, and a plan 187-15 acceptance criterion fails if it is closed
     silently.

7. **Does `harness_audit`'s `validator_ask_user_approved` metadata keep `"validator": <int>`?**
   - After the hoist it becomes `None`. Honest, but it is a governance-artifact shape change. Decide
     and record.
   - → **RESOLVED by D-187-18** — the field is KEPT and its value is `null` for a hoisted armed
     checkpoint (honest: there is no author validator index to name). Ordering is unchanged; only the
     `validator` value moves. Implemented in **plan 187-06** (T-187-06-05) and asserted in **187-11**.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (Postgres :54322) | corpus measurement, SC#10 integration rows, live UAT | ✅ | running | none needed |
| `psycopg2` | live DB evidence | ✅ (in `backend/venv` **only**) | — | must use `backend/venv/Scripts/python.exe` |
| `pytest` | backend suites | ✅ | 9.0.2 | — |
| `vitest` | frontend suites | ✅ | **4.1.0** | ⚠ `--reporter=basic` removed — use default or `json` |
| Redis (`docker-compose.dev.yml`) | SC#6 live confirmation (the ask_user rendezvous is Redis pub/sub) | not probed this session | — | **required** for the SC#6 live row; a unit test with `redis=None` fails safe to `fail_run` (`:988`) and cannot prove the pause |
| OpenAI key | SC#10 row 1 | ✅ configured | — | — |
| Anthropic key | SC#10 row 2 | ✅ configured | — | — |
| Google key | SC#10 row 3 | ✅ configured | — | — |
| DeepSeek key | SC#10 row 4 | ✅ configured | — | — |
| Zhipu key | SC#10 row 5 | ✅ configured | — | — |
| MiniMax key | SC#10 row 6 | ✅ configured | — | — |
| Moonshot key | SC#10 row 7 | ✅ configured | — | — |
| OpenRouter key | SC#10 row 8 | ✅ configured | — | — |
| `HARNESS_AUTHORING_MODEL` | D-187-13's ONE live row | ⚠ unset (`None`) and undocumented in both env examples | — | the automated rows pass `settings` as a parameter and need no env change |
| Chrome MCP | G-4 lived-experience UAT | not probed | — | operator-driven clicks (the documented fallback; Chrome MCP can hang) |

**Missing dependencies with no fallback:** none identified. Redis is the only one that would block a
specific row (the SC#6 live confirmation) and it is a documented always-on local service.

**Missing dependencies with fallback:** `HARNESS_AUTHORING_MODEL` — the 8 automated rows do not need
it; only the single live env-path row does.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | `pytest` 9.0.2 |
| Framework (frontend) | `vitest` **4.1.0** + Testing Library + jsdom |
| Config file (backend) | `backend/pytest.ini` / `pyproject` section (collection verified: 3474 tests) |
| Config file (frontend) | `frontend/vite.config.*` (vitest section) |
| Quick run command (backend) | `cd backend && SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ./venv/Scripts/python.exe -m pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py tests/unit/test_validator_kinds.py tests/unit/test_harness_models.py tests/unit/test_182_severity_codes.py -q --no-header` |
| Quick run command (frontend) | `cd frontend && npx vitest run src/components/workflows/phaseVocabulary.test.ts src/components/workflows/canvasModel.test.ts src/components/workflows/canvasModel.purity.test.ts src/components/workflows/canvasModel.roundtrip.test.ts src/components/workflows/canvasModel.fixtures.test.ts src/components/workflows/PhaseSpineGraph.test.tsx src/components/workflows/PhaseSpine.test.tsx src/components/workflows/PhaseNodeCard.test.tsx` |
| Full suite (backend) | `pytest tests/ -q` |
| Full suite (frontend) | `npx vitest run` — ⚠ **flaky; not a gate** (see baseline) |

### 🔬 Measured baseline (`develop` @ `132b9b26`, 2026-08-02)

| Set | Result |
|---|---|
| Backend collection | **3474 tests collected** |
| Backend armed/vocabulary 5-file set | **72 passed, 0 failed** (0.88 s) |
| Frontend 8-file vocabulary/canvas set (isolated) | **863 passed, 0 failed** (8 files) |
| Frontend 5-file consumer set (isolated) — `WorkflowCanvas`, `PublishGauntlet`, `WorkflowBuilderPage.canvas`, `ProblemsTray`, `definitionOps` | **381 passed, 0 failed** |
| **Frontend FULL suite** | **3617 tests — run A: 3575 passed / 42 failed (9 files); run B: 3568 passed / 49 failed (11 files)** ⚠ **FLAKY at the same commit** |

**Failing files in the full run** (run B, the fuller sample): `PublishGauntlet.test.tsx` 22/46,
`streamsProvider.test.tsx` 10/43, `IngestionPage.test.tsx` 4/4, `ChatHistoryColumn.test.tsx` 4/20,
`WorkflowCanvas.test.tsx` 2/35, `StreamsProvider.dedup.test.ts` 2/9, `model-info.test.ts` 1/8,
`MessageItem.test.tsx` 1/24, `Plan04.frontend.test.tsx` 1/8, `useMessages.test.ts` 1/6,
`streamsProvider_075_9_clientkey.test.tsx` 1/7.

⚠ **`PublishGauntlet.test.tsx` (22) and `WorkflowCanvas.test.tsx` (2) are 100% green in isolation** —
they are suite-interference flake, exactly the 186-15 pattern. **This REFUTES the project memory's
"~14–17 pre-existing frontend vitest failures".**

**Gate rule for this phase:** use the two **isolated named sets** above (863 + 381 = 1244 assertions)
plus the backend 72, each required **non-decreasing**. Guard test **COUNT**, not just failures — a
"net-new" file can silently replace a suite (the Phase-177 lesson). Never gate on the full frontend
suite.

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| **Req 1** | `nodeTitle` resolves 3 tiers; derived tier is pure & unstored | unit | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` | ✅ (extend) |
| Req 1 | Omitting the name context renders byte-identically | unit + snapshot | `npx vitest run src/components/workflows/canvasModel.fixtures.test.ts src/components/workflows/canvasModel.purity.test.ts` | ✅ |
| Req 1 | Re-binding a skill changes the face with **no write** | unit (property over `patchPhaseConfig` + `nodeTitle`) | `npx vitest run src/components/workflows/definitionOps.test.ts` | ✅ (extend) |
| Req 1 | Totality: unknown type / absent config / malformed `available_tools` never throw | unit | `phaseVocabulary.test.ts` (`:150-151` precedent) | ✅ (extend) |
| Req 1 | `?raw` guards still see exactly one vocabulary copy | unit (source grep) | `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx src/components/workflows/PhaseSpine.test.tsx` | ✅ |
| **Req 2** | Every phase of a generated definition carries a non-empty `name` | **integration** (real `forced_emit`) | `pytest backend/tests/unit/test_187_authoring_step_names.py -q` | ❌ **Wave 0** |
| Req 2 | Emitted definition still `model_validate()`s + passes grounding fidelity | integration | same file | ❌ Wave 0 |
| Req 2 | Provider-call budget: 1 / 2 / never 3 | unit (mock `forced_emit`, count calls) | same file | ❌ Wave 0 |
| **Req 3** | Identity-bearing config edit clears a **seeded** name; leaves a **hand-typed** one | unit | `npx vitest run src/components/workflows/definitionOps.test.ts` | ✅ (extend) |
| Req 3 | A pre-187 row loads with the marker absent, no `ValidationError` | unit | `pytest backend/tests/unit/test_harness_models.py -q` | ✅ (extend) |
| Req 3 | Zero migration files added | **structural** (`git diff --name-only -- supabase/migrations \| wc -l` == 0) | phase gate | ❌ Wave 0 |
| **Req 4** | Reveal ON ⇒ card title == reveal-OFF title | unit (render) | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` + a `PhaseNode` render test | ✅ (extend) |
| Req 4 | Full slug present in the DOM with no ellipsis | unit (assert the subtitle node's text contains the whole slug; the subtitle has no `truncate` class) | same | ✅ (extend) |
| Req 4 | `technicalLine` still not passed | unit (assert `[data-testid=…technical-line]` absent) | same | ✅ (extend) |
| Req 4 | Canvas & spine render the same **title** in both toggle states | unit | `PhaseSpineGraph.test.tsx` + canvas render | ✅ (extend) |
| **Req 5** | Grounded steps ⇒ receipt names exactly those steps, with reasons | unit (render `SeedReceipt` with a fixture + `kbTools`) | `npx vitest run src/components/workflows/SeedReceipt.test.tsx` | ❌ **Wave 0** |
| Req 5 | Zero grounded ⇒ no grounded-step list (but the receipt still appears — D-187-10) | unit | same | ❌ Wave 0 |
| Req 5 | Dismisses; does not reappear on the same draft | unit (interaction) | same | ❌ Wave 0 |
| Req 5 | No node-by-node staging animation | unit (source guard: no per-node `setTimeout`/stagger in `SeedReceipt.tsx` / the canvas mount) | same | ❌ Wave 0 |
| **Req 6** | Choosing a template fills the textarea, leaves the user on the describe screen, CTA enabled | unit (interaction) | `npx vitest run src/components/workflows/StarterTemplatePicker.test.tsx` | ❌ **Wave 0** |
| Req 6 | No first-screen path places a definition on the canvas without generation | unit (assert `setDrafted` is never called from the picker path) | `WorkflowBuilderPage.test.tsx` | ✅ (extend) |
| Req 6 | Flag-OFF first screen is unchanged | unit (D-181-01 guard) | `WorkflowBuilderPage.header.test.tsx` pattern, extended to the describe screen | ❌ **Wave 0 — no such pin exists today** |
| **Req 7 / SC#6** | **`armed(phase) ⇒ checkpoint asked before body`, over arbitrary author-declared validator sets** | **property** | `pytest backend/tests/unit/test_187_armed_checkpoint_property.py -q` | ❌ **Wave 0** |
| Req 7 | A refusal does not run the body and writes **zero** approval receipts | unit | same | ❌ Wave 0 |
| Req 7 | `test_185_engine_attachment.py:153-165` stays green | unit (regression) | `pytest backend/tests/unit/test_185_engine_attachment.py -q` | ✅ |
| Req 7 | A non-armed freshness `ask_user` gate behaves byte-identically | unit (the asymmetry net) | `test_185_engine_attachment.py:683` + `test_ask_user_disposition.py:599` | ✅ |
| **D-187-11** | Unbound + KB-reading phase ⇒ one `incomplete` verdict, keyed per node | unit | `pytest backend/tests/ -k validate -q` (extend the `/validate` suite) | ✅ (extend) |
| D-187-11 | The new code is registered — `_severity` returns `incomplete`, not the fail-loud `error` | unit | `pytest backend/tests/unit/test_182_severity_codes.py -q` | ✅ (its COMPOSITION check catches an orphan) |
| **SC#10** | 8 roster rows each emit a valid `WorkflowDefinition` with a non-empty `name` on every phase | **integration** (real provider calls, serial) | `pytest backend/tests/unit/test_187_authoring_step_names.py -q -k roster` | ❌ Wave 0 |
| **SC#5 c1** | Zero reveal-OFF **titles** contain a slug or a raw `phase_type` token, across the corpus | unit (pure function over fixtures) | `npx vitest run src/components/workflows/phaseVocabulary.corpus.test.ts` | ❌ **Wave 0** |
| **SC#5 c2** | No two steps within one workflow render identical faces (⚠ see Open Q1 — narrow first) | unit | same | ❌ Wave 0 |

### 🚨 The SC#6 property test — how to make it count

Per SPEC's acceptance and the Phase-185 lesson (*"observe falsification RED first"*, *"verify the
PROPERTY not the PATCH"*), this test is only meaningful if:

1. **It is written and observed RED on HEAD, before any fix**, and the RED signature is recorded
   (which assertion, what value). A property test that is first run after the fix proves nothing.
2. **It quantifies over author-declared validator sets**, not over one hand-picked example. The
   generator must produce, at minimum: `[]`; `[pre/ask_user]`; `[pre/fail_run]`;
   `[pre/skip_to_phase:X]`; `[post/*]`; `[pre/ask_user, post/citations_required]`; and multi-pre
   permutations. The known bypass is `[pre/ask_user]` + Proceed; **the Pitfall-4 bypass is
   `[pre/fail_run]`** (the disposition resolution routing the checkpoint away). Both must be in the
   space.
3. **The observable is "was the body invoked"**, not "was a validator present". Assert on a spy over
   `_execute_phase` and on `subscribe_for_response` having been awaited **before** it.
4. **It asserts the negative too:** on a refusal, `write_audit` is awaited **zero** times with
   `event_type="validator_ask_user_approved"`. (Phase 185's BLOCKER was a *false approval receipt*,
   not a missing prompt.)
5. **The falsification is observed**, not assumed: after the fix, temporarily remove the checkpoint
   and confirm the test goes red again for the right reason.

### Sampling Rate

- **Per task commit:** the relevant quick-run set for the files touched (backend 5-file set, or the
  frontend 8-file vocabulary set, or the 5-file consumer set).
- **Per wave merge:** backend `pytest tests/ -q` (collection must stay ≥ 3474 + the wave's net-new)
  **and** the two frontend isolated named sets with non-decreasing counts.
- **Phase gate:** backend full suite; frontend **isolated named sets** green with counts ≥ baseline
  (863 + 381 + net-new); `npx tsc -b` clean (⚠ `tsc -b` ≠ `--noEmit` — the v3.3 lesson);
  `vite build` exit 0; `git diff --stat -- supabase/migrations` empty; `git diff --stat --
  frontend/src/pages/WorkflowBuilderPage.tsx` within the D-187-14 cap.

### Wave 0 Gaps

- [ ] `backend/tests/unit/test_187_armed_checkpoint_property.py` — SC#6 property, **observed RED
      first**
- [ ] `backend/tests/unit/test_187_authoring_step_names.py` — Req 2 + the 8-row SC#10 roster
      (serial; roster derived from `MODEL_CAPABILITIES`, never re-typed)
- [ ] `frontend/src/components/workflows/SeedReceipt.tsx` + `.test.tsx` — Req 5
- [ ] `frontend/src/components/workflows/StarterTemplatePicker.tsx` + `.test.tsx` — Req 6
- [ ] `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` — SC#5 checks 1 and 2 over
      the named corpus (3 starters + `four_seed_defs()` + PM pack), as a **pure-function** assertion
- [ ] A **flag-OFF describe-screen pin** (D-181-01) — no such guard exists today; the header pin at
      `WorkflowBuilderPage.header.test.tsx:302-322` is the pattern to copy
- [ ] A structural **zero-migration** gate for the phase
- [ ] Framework install: **none needed**

### Manual-Only (G-4 lived experience — wire format + screenshot are insufficient)

| # | Scenario | Why it cannot be automated |
|---|---|---|
| M1 | Generate a real 5-step workflow and read every node face aloud. Does each say what *that* step does? | "Reads distinctly to a business user" is a judgement, not an assertion |
| M2 | Toggle ⌥ Technical-names ON and OFF three times on both views. Does the plain title survive? Does the layout jump? | Height/jump is perceptual |
| M3 | Watch the receipt arrive on a slow connection. Does the seal pulse fire once? Does anything imply the AI is *still deciding*? | The "implies streaming" failure is temporal and perceptual |
| M4 | Bind a skill to a step, then unbind it, watching the face. Does it track without a save? Does it flicker (Pitfall 1)? | The async-map settle is only visible live |
| M5 | Pick each of the 3 templates. Does the describe box read like something a person would have typed? | Copy quality |
| M6 | **SC#6 live:** run an armed phase carrying a `timing="pre"` `ask_user` validator. Answer the author's gate "Proceed", then confirm the armed checkpoint appears in the chat `PendingAskCard`. Refuse it. Confirm the step did not run and `harness_audit` has **zero** `validator_ask_user_approved` rows for it. | Requires a live Redis rendezvous + a real browser answer. This is the SPEC's own second SC#6 acceptance. |
| M7 | **SC#10 live row:** restart the backend with `HARNESS_AUTHORING_MODEL` set; generate; confirm the model actually used | Proves the env path reaches `resolve_authoring_model` |
| M8 | Turn `visual_workflow_canvas` OFF and open the Builder's first screen. Is it byte-identical to today (no template line)? | D-181-01, and no shipped test covers it |

---

## Security Domain

Security enforcement is **ON**, ASVS **L1**, block on `high`. This phase carries a ROADMAP
threat-model item.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface changes. `/validate` uses the shipped `canvas_caller` hand-off (WR-08); `/starters` is a documented un-gated RUN CARVE-OUT. |
| V3 Session Management | no | — |
| **V4 Access Control** | **yes** | **The armed checkpoint IS an access-control gate** — it decides whether a step body executes. The hoist must not create a path where an author-supplied definition disables it. Also: the template picker must not widen what `/starters` already exposes (it exposes only `is_system_global` published rows, world-readable by mig-056). |
| **V5 Input Validation** | **yes** | `WorkflowDefinition` / `PhaseSpec` / `ValidatorSpec` are `extra="forbid"` `_StrictBase` models (`harness.py:32-35`). The provenance marker rides inside that union — a typo'd key still 422s. Frontend: `PhaseConfigJSON` is the LOOSE JSONB read shape and every read must stay defensive (`Array.isArray` / `typeof` guards, the shipped `groundingCauseOf` idiom). |
| V6 Cryptography | no | — |
| V7 Error Handling & Logging | yes | `harness_audit` receipts are the governance ledger. The `validator_ask_user_approved` metadata shape changes (`validator: None`) — a ledger shape change must be deliberate. `_severity`'s fail-loud warning must not become noisy (register the new code). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Where it bites in 187 |
|---|---|---|---|
| **Governance gate skipped by author-declared config** | Elevation of Privilege | The guarantee is a **property of the phase**, enforced before the body, not a position in a list (D-187-01) | This IS SC#6. The bypass is verified at `harness_engine.py:739`. |
| **Fail-open on an unresolvable disposition** | Elevation of Privilege | `_failing_on_failure(phase, None)` must not be allowed to route the checkpoint to `_route_on_failure` (Pitfall 4) | The hoisted call passes `failed_idx=None`; the disposition resolution at `:979` must be short-circuited when `is_action_risk` |
| **A typed refusal read as consent** | Repudiation / EoP | Exact-match **ALLOW-LIST** against the presented label (`:1194`), never a deny-list | Phase 185 BLOCKER T-185-04-01. **Must survive the hoist untouched.** The property test must include a typed "no". |
| **A false approval receipt** | Repudiation | A `validator_ask_user_approved` row is written only after the allow-list passes (`:1200-1225`) | The 185 BLOCKER filed a FALSE receipt. The property test must assert **zero** receipts on refusal. |
| **Approving a step that never runs** | Repudiation | consequence ≠ receipt — the checkpoint fires only if control reaches the body (D-187-02) | A pre-gate `skip_to_phase` must produce no receipt |
| **A synthesized gate baked into the JSONB** | Tampering | Synthesis is at the run seam only, never a `@model_validator` (`harness.py:218-229`, `grounding.py:886-891`) | `test_grounding_declares_no_model_validator_in_CODE` (`:246`) must stay green; the provenance marker must NOT be a `model_validator` |
| **A client-side "grounded" read used as authorization** | Spoofing | Client PREDICTS, server ENFORCES (D-185-09). `groundingCauseOf` is display-only; the run-time gate is unconditional and server-side | The seed receipt is display; a wrong read is a display bug by construction |
| **A second source of truth for a verdict** | Tampering | Invitation ≠ verdict (D-184-15 / D-182-06): the server owns severity; the client renders the message verbatim | D-187-08 rejects a verdict on `/generate`; D-187-11 puts the verdict on the server |
| **A definition JSONB row that no longer validates** | Denial of Service | Literal sets grow ADDITIVELY; an existing member's spelling never changes (`harness.py:10-21`) | Why the `action_risk_approval` Literal should be **kept** (A1) |
| **A new audit kind killing a run** | Denial of Service | The `harness_audit` `event_type` CHECK is closed at 23 values | `BUG-260731-02`'s exact failure. Reuse `action_risk_pending`. |
| **Unbound retrieval reaching a golden run** | Information Disclosure | A deterministic build-time verdict (D-187-11) | `BUG-260731-03`, severity `blocking` |

### The ROADMAP threat-model item — discharged

> *"the fix touches the D-185-05 attachment seam and must keep
> `test_185_engine_attachment.py:153-165` green or visibly re-shape it with reasoning recorded"*

**Measured:** `:136-166` is `test_a_deliberately_weak_author_spec_cannot_loosen_the_gate`. It builds
a phase with **one author `citations_required` spec** (`max_retries: 7`,
`on_failure: "skip_to_phase:done"`), calls `effective_phase(...)`, and asserts
`len(eff.validators) == 2`, `validators[0].max_retries == 7`, `validators[1].kind ==
"citations_required"`, then `run_gates` failing at `validator_index == 1`.

**It never sets `action_risk_armed`.** D-187-01 removes only the *armed* append, leaving the
`citations_required` append untouched. ✅ **The test stays green as-is with no re-shaping.** The
threat-model item is satisfied by construction, and the plan should pin it with an explicit
"unchanged" assertion rather than a claim.

**The test that DOES break** is `test_arming_adds_no_phase_and_moves_no_phase_index` (`:170-201`,
criterion 18), whose `:191-196` reads `effective[1].validators[0].kind == "action_risk_approval"`.
Its *substance* (arming adds no phase and shifts no `phase_index`) is still true and still worth
asserting; only the mechanism assertion moves. Re-shape it visibly with the reasoning recorded.

---

## Sources

### Primary (HIGH confidence — measured in this session)

- Live local Postgres `127.0.0.1:54322` via `backend/venv/Scripts/python.exe` + `psycopg2` —
  `workflow_definitions` (172 rows, `jsonb_typeof` split 27 object / 145 string, 57 vs 153 phases,
  0 vs 12 names, face-collision counts), the 3 curated starters with full phase + asset shapes, the
  30-column jsonb inventory, `harness_audit` event counts, and the `harness_audit_event_type_check`
  constraint (23 values).
- `backend/app/config.py` — `MODEL_CAPABILITIES` imported live and grouped by `provider`
  (61 models / 8 groups); `harness_authoring_model` at `:1164`; the 8 `*_api_key` fields at
  `:794-807` and `:845-854` (presence checked as booleans only).
- `backend/app/services/harness_engine.py` — `:584-620`, `:660-790`, `:818`, `:826-941`, `:944-1229`,
  `:1240-1340`, `:2040-2170`.
- `backend/app/services/harness/grounding.py` — `:486-510`, `:666-729`, `:790-874`, `:877-953`.
- `backend/app/services/harness/validators.py` — `:195-249`.
- `backend/app/services/harness/validator_kinds.py` — `:710-745`.
- `backend/app/models/harness.py` — `:1-22`, `:32-235`, `:238-300`.
- `backend/app/services/workflow_authoring.py` — `:1-135`, `:200-320`.
- `backend/app/api/workflows.py` — `:171-240`, `:300-336`, `:402`, `:433-540`, `:542-680`, `:745`,
  `:1288-1321`.
- `backend/app/db/workflows.py` — `:285-317`.
- `backend/tests/conftest.py` — `:804-946` (`four_seed_defs`).
- `backend/tests/unit/test_185_engine_attachment.py`, `test_ask_user_disposition.py`,
  `test_validator_kinds.py`, `test_harness_models.py`, `test_182_severity_codes.py`,
  `backend/tests/test_harness_gates.py`, `backend/tests/unit/test_pre_post_timing.py`.
- `frontend/src/components/workflows/phaseVocabulary.ts` (whole file), `canvasModel.ts:255-440`,
  `PhaseNode.tsx:100-209`, `PhaseSpineGraph.tsx:1-216`, `PhaseNodeCard.tsx` (slot grep),
  `definitionOps.ts:190-285`, `builderStore.ts:170-200`, `PhaseFormPanel.tsx:100-150`.
- `frontend/src/pages/WorkflowBuilderPage.tsx` — `:440-600`, `:853-900`, `:1055-1233`, `:1400-1560`,
  `:1778-1790`.
- Live test runs: backend 5-file set (72 passed), backend collection (3474), frontend 8-file
  vocabulary set (863 passed), frontend 5-file consumer set (381 passed), frontend full suite ×2
  (42 and 49 failures at the same commit).
- `.planning/phases/185-…/185-03-PLAN.md:362-366`, `185-03-SUMMARY.md:314-320`,
  `185-SECURITY.md:55-61`, `:266-272` (T-185-03-03's actual text).
- `.planning/reported-bugs/BUG-260731-03-…md` frontmatter + a full sweep of all
  `surface: Agentic-RAG` reports.

### Secondary (MEDIUM confidence)

- `Skill("sketch-findings-agentic-rag")` → `references/node-vocabulary-and-reveal.md`,
  `references/ai-seed-and-templates.md`, `references/icon-convention.md` §4 (read in full, not
  paraphrased from the MANIFEST). ⚠ `node-vocabulary-and-reveal.md:30`'s "10 of 119" is refuted —
  the reference itself should be corrected when the phase ships.
- `.planning/phases/187-…/187-SPEC.md`, `187-CONTEXT.md`, `.planning/ROADMAP.md` §"Phase 187",
  `.planning/REQUIREMENTS.md`, `./CLAUDE.md`.
- `scripts/check-deploy-drift.sh:27-56` (the `OMITTED_FROM_ONEBOX` policy).

### Tertiary (LOW confidence — flagged for validation)

- The "newest model per provider" picks in the SC#10 roster (A2) — ordering by name is a heuristic;
  re-derive at plan time.
- The prediction that the moonshot row fails first (A4).
- Redis availability for the SC#6 live row — not probed this session.

---

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** — no new dependency; every version read from a live run or the venv.
- **Architecture: HIGH** — every seam read in the live source with line numbers, and the four
  citations that had drifted (`grounding.py:951-953`, `validators.py:230`, `PhaseFormPanel.tsx:126-128`,
  `phaseVocabulary.ts:123`) are corrected inline.
- **SC#6 mechanics: HIGH** — the whole control-flow path plus the 25 + 8 + 2 test census was read
  and the 5-file baseline was executed.
- **SC#10 roster: HIGH** — derived by importing the registry, not by grep or by memory. The SPEC's
  four errors are corrected with the measured replacements.
- **Corpus / SC#5: HIGH** — measured at both jsonb depths, with the collision cases named and the
  blocking case (`plan_execute_verify`) verified verbatim against `conftest.py`.
- **Test baseline: HIGH for the isolated sets, MEDIUM-by-nature for the full frontend suite** —
  measured twice at the same commit with different results (42 vs 49), which is itself the finding.
- **Pitfalls: HIGH** — every one is grounded in a measured line or a live run, not in general
  knowledge.

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 for the architecture and the seams; **7 days** for the frontend
full-suite baseline (flaky and drifting), the `MODEL_CAPABILITIES` roster (the registry is edited
often), and the `workflow_definitions` corpus (all rows are throwaway test data and are freely
created/deleted).
