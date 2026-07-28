# Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Every workflow step that reads the knowledge base is **detected**, locked to *must prove it*, and has a
citation coverage gate **enforced by the engine at run time** — whether or not the definition declares it,
including on already-published definitions. Steps that read nothing stay ungated and freely mixable in the
same workflow. Orthogonally, any step may carry an author-set **action-risk checkpoint** that waits
indefinitely rather than expiring into "yes".

This phase is **engine + authoring only**. The review moment (sketch 145), the round trip (sketch 146) and
a dedicated workflow run surface are Phase 188. Zero migrations. Deep chat path byte-identical (D-14).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `185-SPEC.md` for full requirements, boundaries, and acceptance criteria
(23 pass/fail criteria; ambiguity 0.12).

Downstream agents MUST read `185-SPEC.md` before planning or implementing. Requirements are not duplicated
here. Note the two **inline amendments dated 2026-07-29** inside Req 6 and Req 8 (sketch 147) — they are
part of the locked spec, not commentary.

**In scope (from SPEC.md):**
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

**Out of scope (from SPEC.md):**
- A confidence threshold (amended out of GOVERN-01 at spec time — the engine has no confidence concept)
- The review moment (145) and the round trip (146) → **Phase 188**
- A dedicated workflow run surface → **Phase 188**
- `.docx` / `.pptx` / `.xlsx` / `.pdf` inline preview → **its own insert phase immediately after 185**
- Armed-on-by-default for external actions → **Phase 189** (already its SC#2)
- A global fix to `llm_human_input`'s timeout-advances-silently behaviour (armed checkpoints only)
- "Someone else approved it" → **Phase 186**
- Grandfathering / backfill for existing `workflow_definitions` rows (all rows are throwaway test data)
- A third "reads but exploring" grounding state
- A separate refactor phase for `PhaseFormPanel.tsx` (G-5 honoured by construction)
- Rebuilding `PhaseNodeCard.tsx` from 137-D to 137-B (**its own task** — see Deferred)
- A run-state shape for the canvas → **Phase 188**
- Any database migration (live head stays at 113)

</spec_lock>

<decisions>
## Implementation Decisions

### A. What the engine-attached gate actually checks

- **D-185-01 — The gate checks real retrieval evidence AND a text marker.** On a *detected* step
  (`llm_agent` / `llm_batch_agents`), the synthesized `citations_required` gate uses a **new deterministic
  mode** that (a) FAILS when the phase output's `citations` list is empty, and (b) requires ≥ 1 citation
  marker in the text (the shipped `presence` regex, default pattern `\[\d+\]|\(doc[^)]*\)`).

  **Why this is not optional:** the shipped default `deterministic` mode reads `output["field_map"]` and
  returns `GateResult(False, "citations_required: no field_map on output")` when absent
  (`backend/app/services/harness/validator_kinds.py:224-226`). Only `llm_emit` produces a `field_map`.
  Detection only ever fires on `llm_agent` / `llm_batch_agents`, whose output is
  `{text, source_refs, citations, similarity_scores}` (`harness/phase_types.py:490-495`, `:585-590`).
  **Attaching the shipped mode unchanged would fail 100% of detected steps.** The `citations` half cannot
  be faked by the model — those objects come from the retrieval tool via the sub-agent loop
  (`task_service.py:930-937`), folded at `harness_engine.py:296-302`.

- **D-185-02 — The panel's "what this gate does" sentence must NOT reuse the emit wording.**
  `check_coverage`'s "every value traceable, zero invented sources" is computable only over a **structured
  leaf set**. Free prose has no leaves. On an agent step the honest claim is *retrieved-and-pointed-at*,
  not *every value traceable*. Sketch 142-B's shipped copy ("everything it says is checked against your
  documents. Anything it cannot back up fails.") is **emit-path copy** and may not be transplanted verbatim
  onto a detected agent step. Overclaiming here is the exact dishonesty this milestone exists to prevent.

- **D-185-03 — Attachment point: parse-time effective phase.** The synthesized `ValidatorSpec` is folded
  into `phase.validators` when the definition JSONB is parsed into `PhaseSpec`. **Rejected: injecting
  inside `run_gates`** — `GateResult.validator_index` would point past the end of the caller's list, and
  `harness_engine.py:684-694` (the WR-03 `max_retries` rebinding) plus `_route_on_failure` both index into
  it. Parse-time attachment leaves every downstream mechanism unchanged: index routing, retry rebinding,
  `gate_failed` audit rows, the SSE emit — and makes the gate visible to `/validate` and the publish
  gauntlet for free (see D-185-08).

- **D-185-04 — Disposition: retry with feedback, then `fail_run`.** `on_failure: fail_run`,
  `max_retries: 2`. The failure message names what was missing and rides the engine's existing
  retry-feedback loop — mirroring what `_exec_llm_emit` already does on the emit path (cite-or-null
  feedback fed back per attempt). The consecutive-identical short-circuit (T-091-16) already stops a
  pointless loop. **Rejected: `ask_user`** — 185 ships no run surface (that's 188), so an uncited step
  would park a run behind a prompt in a surface the SPEC deliberately left alone.

- **D-185-05 — When the author already declared a `citations_required` validator, the engine's gate runs
  TOO.** Both specs run; first failure wins. This is what makes "not author-loosenable-away" (Req 3)
  **structural rather than trusted** — an author who declares a deliberately weak gate
  (`mode: presence, min_markers: 0`) cannot use it to displace the real one. Accepted cost: a doubled gate
  on hand-strict steps and slightly noisier gate audit rows. **Rejected: replacing the author's spec** —
  that would silently discard an author's `on_failure: skip_to_phase:<slug>` routing and could strand a
  branch reachability already approved.

### B. Where the governance state lives

- **D-185-06 — Both fields sit at `PhaseSpec` level, outside the config union.** Siblings of `validators`
  and `name`. Precedent is exact: `PhaseSpec.name` was added in Phase 103 the same way
  (`name: str | None = None  # additive; pre-103 rows validate with it absent`,
  `backend/app/models/harness.py:194`). The action-risk checkpoint applies to every step type, so a
  union-member field would have to be copy-pasted 6× — six places to forget one.

- **D-185-07 — Store the author's INTENT only; derive everything else at read time.** Of the three causes,
  only `escalated` is authored. `detected` is a pure function of `config.available_tools ∩ KB_TOOLS`;
  `already-set` is a pure function of `config.citation_policy == "strict"` on `llm_emit`. Both are
  recomputable from data already in the row. Persist **only** the escalation bit; derive mode + cause.

  **Consequence — Req 3 becomes true BY CONSTRUCTION.** "No code path anywhere sets a `detected` step back
  to *free to think*" stops being a code-audit claim someone must keep defending: there is **no
  representable value that says it**. A stale or hand-edited JSONB row cannot lie. This is the codebase's
  own unrepresentable-illegal-state idiom (`PhaseGateRow`'s discriminated union; the required `onClose`).

- **D-185-08 — Two flat optional booleans, not one nested object.** e.g. `grounding_escalated: bool = False`
  and `action_risk_armed: bool = False` (final names are the planner's call; the *shape* is locked).
  Additive, no nested model to version, each field's absence unambiguous. GOVERN-01 and GOVERN-03 are
  genuinely orthogonal requirements that ship and evolve independently. **Rejected: a nested `governance`
  object** — it makes "absent object" and "object with both false" two ways to say the same thing.

### C. Who computes detection, and how the surface writes it

- **D-185-09 — The KB tool list is SERVER-supplied; the client only does the intersection.** KB membership
  ships on the **existing** `GET /workflows/grounding-bundle` payload (which already feeds
  `PhaseFormRails.toolOptions` via `useGroundingBundle`). The client intersects locally so the dial,
  strike-through and seal move the instant a tool chip is toggled — no debounce lag, no network hop for
  the refusal reason.

  **The safety argument:** the list has ONE home (server); only the trivial set intersection is duplicated.
  The client **never enforces** — Req 4's run-time gate is unconditional and server-side — so a wrong
  client read is a display bug, never a safety hole. **Rejected: a hardcoded frontend `KB_TOOLS` constant**
  — a second copy of the safety-defining list, and the day a 6th KB tool lands backend-side the canvas
  silently stops marking it. That is the exact drift D-182-06 was written against.

- **D-185-10 — The governance section gets its OWN caller-owned write prop.** `PhaseFormPanel`'s only write
  seam is `onChange: (patch: PhaseConfigPatch) => void`, which patches **`config`** — but these fields sit
  at `PhaseSpec` level. `WorkflowBuilderPage` owns the write via a new handler, exactly the idiom
  `PhaseGateRow.onRemove` already established ("`onRemove` belongs to the CALLER because a gate is a
  `validators` entry, and this panel's only write seam patches `config`",
  `PhaseFormPanel.tsx:76-79`). **Rejected: widening `PhaseConfigPatch`** — it would silently change the
  meaning of a prop whose own shipped docblock defines it as config-only.

- **D-185-11 — Show the synthesized gate at author time; never block publish.** Parse-time attachment
  (D-185-03) makes it visible to `/validate` and the publish gauntlet. Use that visibility: the gate
  appears in the panel's `gates` rail as a `🔒` **locked** row (`PhaseGateRow { locked: true }` — the
  container 184-09 built for exactly this, `PhaseFormPanel.tsx:85-107`), so the author sees the consequence
  of their tool choice before running. **The publish gauntlet gains NO new blocking stage** — publish
  behaviour stays byte-unchanged, and author-time cannot know whether a future run will retrieve anything.

### D. How the armed action-risk checkpoint runs

- **D-185-12 — Mechanism: a synthesized PRE-gate validator.** A new registered kind (e.g.
  `action_risk_approval`, `timing: "pre"`) attached by the **same** parse-time effective-phase mechanism as
  the citation gate — one attachment idiom for both dials. `harness_engine.py:695` already runs
  `run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")` **before** the executor
  body and routes without running it, so "arming does not change `len(phases)` or any `phase_index`"
  (Req 8) holds by construction. Approve → `GateResult(True)`; decline → `GateResult(False)` → routes via
  `on_failure: fail_run`. Existing audit rows and `gate_failed` SSE work unchanged.

  **Known caveat to design against:** this puts an indefinite pub/sub block inside a "gate" abstraction
  whose contract says it never raises into `run_gates`. The shipped `ask_user` on_failure disposition
  (`_resolve_failure_with_ask_user`) already blocks the same way, so the precedent exists — but the
  researcher must confirm `subscribe_for_response`'s no-timeout semantics and how the boot-time resume
  sweep re-subscribes across multiple uvicorn workers (`WORKER_COUNT=2` is the default).

- **D-185-13 — The wait renders on the SHIPPED `ask_user` prompt surface.** Durable prompt row +
  `/pending` replay + the Phase 094 frame, exactly as an `llm_human_input` prompt renders today — in chat.
  Zero new run-time surface, consistent with the SPEC's "engine + authoring only" scope, and Phase 188
  replaces the whole thing with the 145/146 review moment. The canvas's detour edge already says WHERE the
  run stopped.

- **D-185-14 — The approval prompt text is ENGINE-GENERATED from the step.** Composed from the step's
  `name` / plain-language verb and its position (e.g. *"Step 4 of 5, 'Send the summary email', is about to
  run."*). Unlike `llm_human_input`, an armed arbitrary step has no authored `prompt` — generating it keeps
  the armed state a single boolean and the JSONB minimal, and every armed step gets honest copy with zero
  authoring. **No new authored-message field.** The armed wording MAY say the run waits; the unarmed
  `llm_human_input` copy must NOT (Req 9's third acceptance bullet).

  **Side effect worth recording:** with an indefinite wait, the "you closed the tab — the durable row
  survives but the clock keeps running" gap that `references/approval-and-review.md` assigned to Phase 185
  **closes by construction**. "Survives a refresh" and "waits for you" both become true for armed steps.

### E. Which step types carry a dial

- **D-185-15 — The dial exists ONLY on `llm_agent` and `llm_batch_agents`.** They are the only configs with
  `available_tools` — i.e. the only steps that can ever *satisfy* the gate. `llm_emit` shows its grounding
  state as **read-only** text (the `already-set` cause is owned by the existing `citation_policy` dial,
  unchanged — SPEC Req 3). `llm_single` / `llm_human_input` / `programmatic` render **no dial element at
  all** (Req 5: absent, not disabled).

  **The trap this closes:** an `llm_single` can never be *detected* (no `available_tools`), but nothing
  structural stops an author *escalating* one — and an escalated `llm_single` has no retrieval path, so
  D-185-01's gate would fail it on **every single run**. An author-reachable way to build a permanently
  failing step. Restricting the dial to retrieving types makes that state unrepresentable rather than
  documented.

- **D-185-16 — A step type with no dial still renders the governance section**, carrying the locked phrase
  **"Nothing to prove here"** (Req 7's binding vocabulary for connectors and question-to-a-human steps) and
  no control. The author learns *why* there is nothing to set, the required-term grep (≥ 1 occurrence) has
  a home, and "this step is ungoverned" never reads as "this build forgot to render it".

### F. Post-research lock reconciliation (added 2026-07-29 after `185-RESEARCH.md`)

`185-RESEARCH.md` §"⚠ Lock Conflicts" found three places where the locked SPEC/CONTEXT reasoned from
code that is not what ships today. None changes a requirement; each needed an explicit call. All three
were verified against the live tree before deciding.

- **D-185-17 — LC-2: the 137-B card rebuild is sequenced as Wave 1 of THIS phase, as its own plan.**
  SPEC Req 6's amendment moves the verdict mark to `-left-2 top-1.5` and adds the acceptance criterion
  *"a zone check … reports 0 overlaps between rendered marks."* Computed against the **shipped** card
  (`PhaseNodeCard.tsx:238-240` `ml-6`, `:293-313` verdict, `:311-313` icon well `left-0 top-1/2 h-14 w-14`,
  `canvasModel.ts:62-66` 260×96): the icon well occupies x 0…56 / y 20…76, so a verdict at `-left-2 top-1.5`
  (x −8…14, y 6…28) **overlaps it 14×8 px**. Worse, `ml-6` puts the frosted card's left border at x = 24, so
  on 137-D `-left-2` does not straddle the card edge at all — it floats 10 px clear of it. **No left
  placement reproduces the operator's intent on 137-D.**

  The SPEC's own sentence — *"185 places its marks against 137-B"* — is only true if 137-B exists when the
  marks land. Therefore the deferred geometry rebuild (`padding-top` 34 → **42**, `NODE_MIN_HEIGHT` 96 →
  **104**, the 248 px centred card, the icon to the top edge, plus the two docblocks at
  `PhaseNodeCard.tsx:287` and `WorkflowCanvas.tsx:502-504` that already reason from 137-B) ships as
  **its own PLAN file in Wave 1**, before any governance mark is placed.

  This honours the operator's 2026-07-29 wording rather than contradicting it: *"its own task, **not
  smuggled into** a governance phase."* A separately-planned, separately-committed Wave-1 plan is the
  opposite of smuggling. **Rejected: moving the seal to top-left** (amends Req 6's CLAIMED corner — a lock).
  **Rejected: weakening acceptance criterion 23** (the operator added it on purpose, after a computed
  occupancy audit). **Rejected: an ad-hoc y-offset on 137-D** — it clears the icon only by abandoning the
  card edge, i.e. it invents a third geometry nobody approved.

  ⚠ **This is the one scope decision taken without the operator in the room. It is the single most
  reversible thing in the phase: drop the Wave-1 plan file and Wave 2+ still build, with acceptance
  criterion 23 failing until the rebuild lands separately.**

- **D-185-18 — LC-1: the detour edge IS net-new canvas infrastructure; plan it as its own task with a
  no-visible-change guard on ordinary edges.** SPEC Req 8's build note says the detour *"rides the
  `edgeTypes` entry named `flow` that `WorkflowCanvas.tsx:279` already registers — no net-new canvas
  infrastructure."* **That entry does not exist.** `grep -rn edgeTypes frontend/src` returns exactly one
  hit: a comment at `WorkflowCanvas.tsx:279` stating *"183 registers none"*. `canvasModel.ts` sets
  `data.kind` on all four edge-push sites and never sets `edge.type`.

  The requirement is unchanged — armed renders a solid detour arc that IS the path, unarmed renders a faint
  dashed ghost with the line through — but the work is four pieces (a `FlowEdge` component, a module-level
  `edgeTypes` map, `edge.type` now set in `toCanvas`, and `markerEnd` re-rendered inside the custom edge),
  and setting `type` switches **every** flow edge from the library's default renderer to ours. The plan
  must carry an explicit acceptance criterion that an ordinary unarmed edge renders identically to today.
  No estimate may treat this as "just wire the data".

- **D-185-19 — LC-3: the `🔒` locked gate row is CLIENT-synthesized; nothing waits on `/validate`.**
  D-185-11 assumed parse-time attachment makes the synthesized gate visible to `/validate` "for free".
  `POST /workflows/validate` returns `ValidateResponse(ok, verdicts)` where a verdict is
  `{code, phase, message, severity}` (`api/workflows.py:645-653`) — a list of **problems**, with no channel
  for "here is a gate that will run", and a passing gate produces nothing. The intended outcome still
  holds and needs no lock amendment: the client already holds `available_tools` and (per D-185-09) the
  server's `kb_tools`, so the panel synthesizes the `🔒` row locally — the same client-predicts /
  server-enforces split D-185-09 already establishes. **No task may expect `/validate` to return the row.**
  The **publish** half of D-185-11 is true and does bite: the gauntlet's golden run now enforces the gate.

### Claude's Discretion

- Exact field names for the two PhaseSpec booleans (D-185-08 locks the shape, not the spelling).
- The exact registered `mode` string for the new citations_required behaviour (D-185-01).
- The exact `grounding-bundle` payload extension carrying KB membership (D-185-09) — whether a separate
  `kb_tools` array or a per-tool flag; the researcher should read the shipped payload shape first.
- The generated prompt's precise sentence construction (D-185-14), subject to the Req 9 honesty rule.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-locking documents (read first, in this order)
- `.planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-SPEC.md` —
  **Locked requirements — MUST read before planning.** 9 requirements, 23 acceptance criteria, 12
  out-of-scope items with reasons. Contains two inline amendments dated 2026-07-29 (Req 6 and Req 8) that
  are part of the lock.
- `.planning/REQUIREMENTS.md` §GOVERN — GOVERN-01 / -02 / -03, with GOVERN-01's "confidence gate" phrase
  formally amended out on 2026-07-28.
- `.planning/ROADMAP.md` lines 235-268 (Phase 185 block) + lines 369-374 (G-2 / G-5 / SC#10 / migration
  policy for this milestone).

### Design lock (operator-approved sketches — constraints, not options)
- `.claude/skills/sketch-findings-agentic-rag/references/graded-governance.md` — sketches 142 (the dial,
  winner B) + 143 (the canvas mark, winner A). The one-way lock table, the `KB_TOOLS` list, the
  "lobotomy-not-loophole" refusal copy, the seal-is-load-bearing rule, the binding vocabulary table, and
  the CSS for the dial / seal / refusal box.
- `.claude/skills/sketch-findings-agentic-rag/references/approval-and-review.md` — sketch 144 (the stop
  sign) + 145/146 (owned by Phase 188). **Read §"TWO ENGINE TRUTHS"** — the timeout-expires-into-yes proof
  and the failure-mode ownership table.
- `.planning/sketches/147-the-armed-mark/` (`index.html` + `README.md`) — the detour edge, the occupancy
  audit that moved the verdict mark left, and the panel-owns-arming decision. Not yet packaged into the
  findings skill; the SPEC's Req 6/Req 8 amendments carry its conclusions.
- Invoke `Skill("sketch-findings-agentic-rag")` when touching any canvas / panel / phase-node component.

### Backend — the engine surface this phase changes
- `backend/app/models/harness.py` — `PhaseSpec` (:189-194, the additive-field precedent), the 6-member
  `extra="forbid"` `PhaseConfig` union (:157-167), `ValidatorSpec` (:170-187).
- `backend/app/services/harness_engine.py:670-760` — `_run_phase_with_gates`: the pre-gate pass (:695), the
  WR-03 retry rebinding (:684-694), `_route_on_failure`.
- `backend/app/services/harness/validators.py:215-248` — `run_gates` and the `validator_index` contract.
- `backend/app/services/harness/validator_kinds.py:198-238` — the shipped `citations_required` validator
  and its two modes (**the `field_map` blocker lives at :224**).
- `backend/app/services/harness/phase_types.py:422-495` (`_exec_llm_agent` output shape), `:560-592`
  (`_exec_llm_batch_agents` grounding union), `:594+` (`_exec_llm_human_input` — the timeout that must stay
  byte-identical for unarmed steps), `:1176` (the executor-internal emit citation gate — do not touch).
- `backend/app/services/harness/grounding.py` — the D-182-06 red line: exactly ONE copy of every grounding
  rule, server-side, never client-side. Read its module docblock before adding any derivation anywhere.

### Frontend — the authoring surface this phase mounts into
- `frontend/src/components/workflows/PhaseFormPanel.tsx:60-130` — `PhaseGateRow` (the discriminated-union
  gate row), `PhaseFormRails`, and the `onChange`-patches-`config` contract that D-185-10 works around.
  **1078 lines — 185 adds a mount point only (G-5 honoured by construction).**
- `frontend/src/components/workflows/phaseVocabulary.ts:200-235` — `groundingFor()`, the 3-face word-badge
  **this phase deletes**, and `waitsForYou()`.
- `frontend/src/components/workflows/PhaseNodeCard.tsx` — the verdict mark at `-right-2 top-1.5` (:298)
  that moves to `-left-2`; the no-focusable-control-inside-the-card rule (:37-48).
- `frontend/src/components/workflows/WorkflowCanvas.tsx:279` (`edgeTypes` `flow` registration — the detour
  rides this), `:618-627` (the ✕ geometry the arc must clear).
- `frontend/src/components/workflows/canvasModel.ts:88` — `edge.data.kind`, which carries the armed state.
- `frontend/src/hooks/useLiveValidation.ts` — abort + monotonic-sequence last-write-wins; the app's only
  call to the `/validate` seam.

### Project rules that bind this phase
- `CLAUDE.md` §"Workflow guardrails" (G-1…G-6 + hot-file ledger), §"UAT scoreboard recipe" (SC#10's
  4 axes), §"Provider-docs-first".
- `.planning/PROJECT.md` — D-14 (Deep byte-identity red line), D-v2.5-01 (no blocking I/O in async
  handlers — relevant to the indefinite subscribe in D-185-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PhaseGateRow` + `PhaseFormRails.gates`** (`PhaseFormPanel.tsx:85-107`) — an empty container shipped by
  184-09 whose own docblock names Phase 185 as its intended consumer. D-185-11 fills it. Its
  discriminated-union shape already makes "a locked gate with a remove button" unrepresentable.
- **`run_gates(..., timing="pre")`** (`validators.py:215`, called at `harness_engine.py:695`) — a
  before-the-body gate pass that routes without executing the phase. D-185-12's whole mechanism.
- **`citations_required` `presence` mode** (`validator_kinds.py:208-221`) — the marker-count half of
  D-185-01 already exists, regex-configurable.
- **The `ask_user` substrate** — durable prompt row, `tool_call_id`, `subscribe_for_response`, boot-time
  resume sweep, `/pending` replay, the Phase 094 render frame. D-185-13 reuses it whole.
- **`GET /workflows/grounding-bundle` + `useGroundingBundle`** — already delivers the tool palette to the
  panel; D-185-09 extends the payload rather than adding a route.
- **`edgeTypes` `flow`** (`WorkflowCanvas.tsx:279`) + `edge.data.kind` (`canvasModel.ts:88`) — the detour
  is a custom edge on existing infrastructure. **No net-new canvas infrastructure.**
- **`useLiveValidation`** — abort + sequence guard already solved; the canvas takes `verdicts` as a prop.

### Established Patterns
- **Additive-optional model extension** — `PhaseSpec.name` (103) and `LlmEmitPhaseConfig` (101.1) are the
  two worked examples of adding to an `extra="forbid"` model so pre-existing JSONB rows still
  `model_validate()`. Follow them literally.
- **Unrepresentable illegal states over documented rules** — `PhaseGateRow`'s union, the REQUIRED
  `onClose` prop, `definitionOps`' typed refusals. D-185-07 and D-185-15 both apply this idiom.
- **Refusal reasons are real DOM text wired by `aria-describedby`, never a `title`** — the 184-07 lesson,
  already enforced in `StepTypePicker`.
- **The component authors no reason of its own** — `StepTypePicker` asserts its rendered sentence is
  character-identical to `definitionOps.STRANDING_REASON`. The governance component should source its
  refusal copy the same way.
- **One rule, one home, server-side** — `grounding.py`'s D-182-06 red line. D-185-09 respects it by
  serving the LIST and duplicating only a set intersection that never enforces.
- **Per-file test count pins** — `scripts/vitest-count-gate.cjs` pins counts per file, not just failures
  (the Phase-177 lesson). New suites must be added to `TARGETS`.

### Integration Points
- `PhaseSpec` parse → the effective-phase synthesis (D-185-03, D-185-12) — the single backend seam both
  gates attach through.
- `PhaseFormPanel` mount point → the new self-contained governance component (G-5 honoured by
  construction) + the new caller-owned write prop wired in `WorkflowBuilderPage`.
- `phaseVocabulary.groundingFor()` → **deleted**, along with the three retired badge strings; the canvas
  seal replaces it.
- `PhaseNodeCard` → seal at top-right (CLAIMED), verdict mark relocated to `-left-2 top-1.5`.
- `WorkflowCanvas` `edgeTypes.flow` → the armed/unarmed detour rendering.

</code_context>

<specifics>
## Specific Ideas

- **The gate's honesty is the deliverable, not a detail.** D-185-02 exists because the shipped 142-B copy
  is emit-path copy. If the agent-step sentence claims "every value traceable", the milestone's headline
  differentiator ships as an overclaim — the precise failure it was built to prevent.
- **"Not author-loosenable-away" is enforced in two independent places, on purpose:** the state is
  unrepresentable (D-185-07) *and* a weak declared gate cannot displace the engine's (D-185-05). Either
  alone degrades to a rule someone must keep defending.
- **The client predicts; the server enforces.** Stated as the acceptance framing for D-185-09 — a wrong
  client read is a display bug by construction, never a safety hole.
- **G-4 lived-experience UAT — operator-defined at scope time (all four selected). Chrome MCP drives these
  at phase verification; wire format + screenshot are insufficient:**
  1. **Watch a step lock in front of you.** Switch on *Search your documents* and watch three things move
     at once with no reload: the loose side strikes through, pressing it prints the refusal reason as
     readable text, the canvas card grows its corner seal. *Failure: any of the three lags behind the chip,
     flickers, or only appears after a refresh.*
  2. **The seal survives a live run.** Launch a run; watch a grounded card go idle → running → needs-you →
     failed. *Failure: the seal dims, hides, shifts, or is swallowed by the status colour — at exactly the
     moment it matters most.*
  3. **Arm it and walk away.** Arm an outbound step, launch, close the tab, come back much later. *Failure:
     the run advanced on its own (today's behaviour), or the prompt survived but is unreachable.*
  4. **The detour reads as a detour.** Armed: the connector visibly leaves the flow and returns through the
     person-point, with NO straight line past it. Unarmed: faint dashed ghost with the line through.
     *Failure: armed and unarmed are indistinguishable at a glance, or the arc collides with the ✕ or ＋.*
- **SC#10 applies** — UAT must cover OpenAI / Anthropic / Google / OpenRouter plus one multi-tool row, one
  parallel-thread row, and one long-message row. A grounded node's citation enforcement rides the
  provider-sensitive retrieval/agent path, so D-185-01's `citations`-non-empty check is exactly the thing
  that can vary per provider.

</specifics>

<deferred>
## Deferred Ideas

- ~~**`PhaseNodeCard` 137-D → 137-B geometry rebuild**~~ → **NO LONGER DEFERRED. Pulled in as Wave 1 by
  D-185-17** after the research pass computed that no left-edge verdict placement satisfies acceptance
  criterion 23 on the shipped 137-D card. It keeps its "own task" status as its own Wave-1 PLAN file. The
  original reasoning is retained below for the record:

- **`PhaseNodeCard` 137-D → 137-B geometry rebuild** — the locked decision is 137-B (`canvas-184.css:170-171`,
  operator 2026-07-26) but the shipped component renders 137-D (`PhaseNodeCard.tsx:311-313`). Confirmed by
  the operator on 2026-07-29 together with two corrections: `padding-top` 34 → **42** and `NODE_MIN_HEIGHT`
  96 → **104** (11px icon clearance instead of 3). **Its own task** — it moves the icon, the verdict mark
  and the step number together, and must not be smuggled into a governance phase. Two shipped docblocks
  (`PhaseNodeCard.tsx:287`, `WorkflowCanvas.tsx:502-504`) reason from 137-B on a component rendering
  137-D; correcting them belongs to the same task. **185 places its marks against 137-B and must not also
  rebuild the card.**
- **`.docx` / `.pptx` / `.xlsx` / `.pdf` inline preview** → **its own insert phase immediately after 185**
  (operator, 2026-07-28, superseding the sketch wrap-up's "defer to 190"). Its consumer
  (`FilesSection` → `FilePreview`) already ships.
- **The review moment (145), the round trip (146), a dedicated run surface, and a colour-blind-safe
  run-state shape** → **Phase 188**.
- **"Someone else approved it"** (a second approver must be told who decided) → **Phase 186**.
- **Armed-on-by-default for external actions** → **Phase 189** (already its SC#2).
- **The stepNumber slot** — the relocated verdict mark grazes it by 2×16px, but that slot renders nothing
  (D-183-07 keeps `phase_index` off the face). If it is ever brought to the face, move it to `left:16` and
  the overlap clears.
- **Sketch-143-B fallback** (a stitched rail outside the border, surviving run status intact) — documented
  swap, not a redesign, if the corner seal proves too quiet in live use.
- **Open reported bugs with Phase-188 affinity, NOT folded here:** `BUG-260609-02` (phantom generic
  "Sub-task" in the Sub-Results panel) and `BUG-260609-04` (`phase-0` placeholder slug, reconcile-floor
  clobber). Both are `frontend/panel` + `harness/run-honesty` — the PhaseCard/PhaseTimeline **run**
  surface, which the SPEC routes to 188. Left `open`; no frontmatter changed. The other three open
  `surface: Agentic-RAG` reports (`BUG-260718-02/-03/-04`, `BUG-260722-02`) are chat/streaming/model-
  selection and do not touch this phase's domain.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (matched at score 0.6 on the keywords *grounded / human / before*) —
  the NL→workflow authoring spike (describe + upload-template → AI-derived inputs/phases → KB-grounded fill
  → human refine → run). **Not folded:** it is the VOCAB track and belongs to **Phase 187**, which already
  depends on 185 for "a seeded grounded node auto-gets its citation gate". The keyword overlap is
  vocabulary, not scope.

</deferred>

---

*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Context gathered: 2026-07-29*
