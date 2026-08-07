# Phase 189: Governed External-Action Node Model - Context

**Gathered:** 2026-08-06
**Refreshed:** 2026-08-07 — the G-5 gate discharged, file pointers re-measured, three open bugs routed.
**Discussed with the operator:** 2026-08-07 — six choices put in plain language; **four ratified
D-01..D-13 unchanged, two closed the open wording items** (D-15..D-18 below).
**Amended at plan-phase:** 2026-08-07 — research measured **three conflicts between locked decisions
and shipped code**; the operator was unattended and delegated the calls. **D-19 … D-22 added; no
prior decision re-opened.** Two of them mean **D-06 ("the workflow publishes") is FALSE at HEAD** —
that is now this phase's headline gate, not an assumption.
**Status:** Ready for planning — **UNBLOCKED. Phase 188.2 has shipped.**

<domain>
## Phase Boundary

189 delivers the **vocabulary and governance wiring** for an external-action node on the
workflow canvas, plus a **durably recorded architecture decision** — with **no live outbound
egress**. Live connectors are Phase 190 (STRETCH).

Requirement: **CONN-01**. Operator HARD gate #3, CORE half.

What this phase is NOT: it is not a connector. Nothing this phase ships makes a network call to
a third party. The deliverable is a node a user can place, govern, publish and run, whose
external step honestly records what it *would* do.

**Flags carried from ROADMAP:** no SC#10 (design/vocabulary, no live stream) · no threat model
(it lands WITH 190, which owns the first user-supplied-destination egress surface) · red line
D-14 (the Deep path stays byte-identical) · UI hint yes · **G-2 does NOT fire** — ROADMAP
**line 675** exempts 189 by name as "the design/decision phase".

**⚠ ONE FLAG IS AMENDED BY THIS DISCUSSION: "no migration" → migration 115.** See D-08.
</domain>

<gate>
## ⚑ G-5 GATE — DISCHARGED 2026-08-07 (188.2 shipped)

**The gate is closed. This block is kept rather than deleted, because the sequencing it records
is the reason 188.2 cut where it did.**

> *Superseded wording, preserved (2026-08-06):* "**G-5 fires on
> `frontend/src/components/workflows/PhaseNodeCard.tsx`** — `wc -l` = **797 lines**;
> `git log -- <file>` shows **4 distinct phases** (184, 185, 188, 188.1), over the 3-phase
> threshold. 189 adds a node type, which lands on that file. **Operator decision:** insert a
> dedicated behaviour-preserving refactor phase **188.2** BEFORE 189 executes."

**What actually happened, measured 2026-08-07 (`wc -l`, `git log --oneline -- <file>`):**

| | Then (2026-08-06) | Now |
|---|---|---|
| `PhaseNodeCard.tsx` | 797 L, G-5 **fires** | **274 L** (−65.6 %), ledger row reads *satisfied (188.2 — 2026-08-07)* |
| Gates | — | 188.2 executed 7/7 · verified 7/7 · secured 34/34 · validated 12 green / 7 partial |
| `BUG-260806-01` (selected card occludes its own ✕) | fold candidate for 188.2 | ✅ **closed**, `verified_closed_by: 188.2` — on a driven `elementFromPoint` row **with a falsification control observed swinging both ways**, not on the stacking analysis |

**The inverted sequencing paid off, and that is a measurable claim rather than a compliment:**
this discussion ran BEFORE the refactor so the cut would not be blind. It was not —
`phaseNodeCardContract.ts`'s own docblock (`:6-7`) reads *"This is the surface 185 / 188 / 189 add
DATA to, so it is cut out on its own: **189 adds a slot to a contract of this size rather than to
a 797-line component**."* All three seams this phase named were cut for: a 7th `phase_type`'s
face, a conditional badge in slot 1, a capability-derived subtitle.

**⚠ THE ONE COST 188.2 RECORDED HONESTLY, and 189 inherits it:** the six-file subtree GREW
**797 → 1332 L (+67.1 %)** — roughly eight times 188.1's +8 %. 189 adds to a *paid-down card*,
but to a *larger directory*. Prefer filling an existing slot over creating a sixth module.
</gate>

<decisions>
## Implementation Decisions

> **D-01 … D-13 are LOCKED as written on 2026-08-06.** The 2026-08-07 refresh re-verified every
> load-bearing measurement each one rests on (results in `<verification_2026_08_07>` below) and
> changed **no decision**. Where a decision names a FILE, the file may have moved — the decision
> did not.

### The node's structure

- **D-01: A 7th `phase_type` — `external_action`.** Appended to the `PhaseConfig` discriminated
  union as a 7th member. This is the trodden path, not an invention: `LlmEmitPhaseConfig`'s own
  docblock calls it *"the standard extension (the 5 existing members were added this way)"*, and
  `models/harness.py:10` records *"The two Literal sets GROW ADDITIVELY, and always have"*
  (5 → 6 at 101.1). Additive-optional; `_StrictBase` rejects unknown keys; old JSONB phase rows
  still `model_validate()`. Rejected: config-on-`llm_agent` (makes "external action" invisible in
  the schema, forcing the canvas to infer a node's nature from a tool-name string — the exact
  inference the 187 face ladder exists to avoid) and a `PROGRAMMATIC_PHASE_REGISTRY` entry
  (programmatic phases are internal engine operations with no author-facing config surface).

- **D-02: The author picks a NAMED CAPABILITY from a CLOSED SET** (shape: `send_email`,
  `create_ticket`, `post_message` — the exact membership is a planning decision, but it must
  align with 190's email / JIRA / Slack slice). Closed-registry discipline, matching
  `_TOOL_REGISTRY` and `PROGRAMMATIC_PHASE_REGISTRY`: *a name not present raises in the executor
  — never resolved dynamically, never eval'd.* Rejected: one generic node (the canvas could only
  ever say "reaches outside", weakening SC#2's business-vocabulary promise) and author-supplied
  MCP server + tool identifiers (puts a wire-level token on a business canvas, and with **zero**
  MCP code in the backend today nothing could reject a typo until 190).

### Governance rails — zero new concepts

- **D-03: The capability IS an entry in `available_tools`.** Choosing a capability writes that
  name into the phase's `available_tools`, so it flows through `resolve_phase_available_tools`
  (`backend/app/api/runs.py:671` — **re-read server-side at run time, never trusted from the
  client**, D-08 of Phase 184) and the closed `_TOOL_REGISTRY` exactly like every other tool.
  SC#1's "rides the existing per-phase tool-whitelist guard" is then literally true: the guard
  that already exists is the guard. **Verify at planning:** capability names must be DISJOINT
  from `KB_TOOLS` (`grounding.py:797`), because grounding detection is
  `available_tools ∩ KB_TOOLS` — a collision would silently arm the grounding dial.
  Rejected: a parallel guard (a second enforcement path, against both the one-home-per-concern
  red line and this phase's own "zero new governance concept" flag) and mirroring one fact into
  two representations (the drift shape `useCanvasGate`'s one-definition rule exists to prevent).

- **D-04: `action_risk_armed` is STRUCTURALLY TRUE and NOT disarmable on this node type.** Not a
  default the author can clear. SC#2 says the node "cannot be wired around a gate", and 185's
  hard-won rule is that a gate which can be loosened away is not a gate. **This is not a new
  finding — sketch 144 reached it independently at Phase 185 and named this phase:** *"the
  unarmed outbound step on screen argues armed-on by default (= 189 SC#2)"*, and the findings
  skill's load-trigger reads *"Building an external-action / connector node (Phases 189/190) —
  it arrives armed-on by default."* The 185 refusal vocabulary already exists to say why; reuse
  it rather than authoring new copy. Accepted cost: no escape hatch for a genuinely harmless
  external action — revisit at 190 if real usage demands it, never by loosening this node.

### What "no live egress" means at run time

- **D-05: On approval, the step RECORDS THE INTENDED ACTION and the run CONTINUES.** The step
  emits a structured record of what it would have done (capability + resolved inputs) as its
  output. 190 swaps the no-op for a real MCP call behind an unchanged seam. Rejected: a hard
  refusal (the node would be demonstrable only up to the point it is reached) and skipping the
  step (a silently-skipped governed step is the fail-open shape Phase 188 spent two plans
  closing — `finalizeAllPhasesForThread` sweeping `pending` → `done` — and it makes the
  arming decorative).

- **D-06: A workflow containing the node PUBLISHES and RUNS.** The 8-stage gauntlet treats it
  as any other governed node. 189 is a real shippable slice, not a drawer of unpublishable
  drafts, and 190 gets a live workflow to upgrade in place.

- **D-07: The not-sent state gets its OWN WORDED STATUS**, distinct from passed/done at every
  surface it renders — canvas node, run surface, phase output. Phase 188 proved this instrument:
  an unrecognised wire status renders **"State unknown"**, never "Complete". Binding constraint
  from the design record: **"running" and "waiting for you" may never share a word** — the same
  discipline applies here, and the new word must not collide with either.

- **D-08: ⚠ AMENDS THE ROADMAP — migration 115 persists the 6th status value.** Measured:
  `workflow_phases_status_check` caps `status` at exactly five values
  (`pending, active, completed, failed, skipped`, `supabase/full-schema.sql:1932`), so a genuinely
  new persisted status needs a migration. **Precedent is near-exact and its reasoning transfers
  verbatim** — Phase 185 amended its own zero-migration promise for migration 114, and the
  ROADMAP records why: *"the zero-migration promise was a scoping convenience; the honest-pause
  vocabulary is a correctness property, and the alternative knowingly ships the defect the phase
  existed to fix."* One literal added to one CHECK and nothing else. Rejected: deriving the word
  at render while the column stays `completed` (real precedent — 188's wire-only "State unknown"
  — but the ROW then reads *completed* forever to anything querying the table directly) and
  reusing `skipped` (lies in a different direction: the step DID run, a human DID approve, work
  WAS recorded).

- **D-09: Recorded in the PHASE OUTPUT ONLY — no new `harness_audit` event.** A new event type
  means a CHECK-constraint migration **plus** the Python literal set in `db/workflows.py:120-136`
  (exactly what 185 did for `action_risk_pending`). Nothing is lost: the existing
  `action_risk_pending` receipt already records that a human was asked and approved. Deferred to
  190, when the receipt would describe a real consequence — consequence and receipt stay aligned.

### The recorded architecture decision (SC#3)

- **D-10: A doc under `docs/` + a citable D-entry in `.planning/prd-reset/DECISIONS.md`.**
  `docs/` holds the long-lived operator/architecture docs this repo actually maintains and
  survives milestone archiving; `DECISIONS.md` is the D-numbered register CLAUDE.md points at.
  **The D-entry POINTS AT the doc — it must not restate it** (one home per concern).
  Rejected: DECISIONS.md alone (a verdict with a competitive-research basis would either bloat
  the terse register or lose its reasoning) and updating SEED-013/014 in place (seeds are a
  dormant backlog with re-open triggers; a decision buried in a seed reads as still-pending).

- **D-11: RECORD the existing verdict with a dated re-open trigger — do not re-validate.** The
  deep competitor crawl already reached **MCP-first, first-party-thin, broad catalog sequenced
  with Open Platform (SEED-013/014)** and that research is on file. 189 writes it down with an
  explicit trigger naming what would overturn it (e.g. MCP spec churn; a connector need no MCP
  server covers). Matches the standing project rule that every deferral carries a concrete
  re-open trigger. 190 pins the MCP spec version regardless.

### The node's face on the canvas

- **D-12: Spend badge slot 1 on the NOT-YET-CONNECTED state, conditional on that state rather
  than on the type.** 189 holds the **last free word-badge** on the card. It is spent on the one
  fact the card cannot otherwise carry: this step reaches outside and is not wired to anything
  yet. The armed-for-approval fact is invariant for the type (a badge that is always present on
  a type is really part of the type), and 185 set the precedent by spending **no badge at all**
  on governance — it used the corner seal, and deleted `nodePresentation.GROUNDING_TONE`.
  **Because the badge is conditional on state, it retires cleanly when 190 connects the node.**

  **⚠ RE-VERIFIED AND STRENGTHENED 2026-08-07 — the reservation survived the 188.2 cut and is now
  MACHINE-GUARDED, not merely documented.** The 2026-08-06 wording cited a single docblock
  sentence in a 797-line component. That sentence moved; the fact did not, and it is now asserted
  in **five source files and guarded by two live test suites**:
  `PhaseNodeCard.tsx:39` · `canvasModel.ts:138` ("both badge slots are committed to 188/189") ·
  `NodeCornerMarks.tsx:25` · `PhaseNode.tsx:209`/`:259` ("a badge slot 188/189 owns"), with
  `PhaseNodeCard.test.tsx:2147-2156` ("slot 1 is still empty and still reserved") and
  `WorkflowCanvas.test.tsx:422-423` failing if it is spent early.
  **The max-2 budget is likewise now type-enforced AND control-tested:** `BadgeSlots`
  (`phaseNodeCardContract.ts:104`) is a max-2 tuple union, and 188.2-01 added an
  `@ts-expect-error` control **observed RED at 34 type errors and back at 33** — so a third badge
  does not get flagged, it does not compile. **189 spends slot 1 and no more.**

- **D-13: The vocabulary ladder's middle tier is CONFIG-DERIVED from the chosen capability** —
  "Sends an email", "Creates a ticket" — falling back to a generic type sentence only when no
  capability is chosen yet. This is precisely what tier 2 of the **148-C layered ladder** exists
  for (author name → config-derived → type sentence, **computed at render, never stored**), and
  it is the fix for the measured VOCAB-02 failure: only **10 of 119** phases carry a `phase.name`,
  so the generic sentence is what users actually see.

### Bug routing (operator, 2026-08-07)

- **D-14: `BUG-260807-01` is fixed by `/gsd:fast` BEFORE 189 plans — it is NOT folded into this
  phase.** The report's own "Suggested routing" section proposed folding it into 189 as "a natural,
  cheap rider". The operator routed it out instead, and the sizing supports that: **one file, one
  import, two call sites** (`editAffordance.ts:214-224` → `own()` from the zero-import leaf
  `ownProperty.ts`), no schema and no API surface — squarely G-3 `/gsd:fast` territory. It is
  188.2's own residue and it degrades a fix 188.2 just shipped, so it does not belong on 189's
  ledger. **Two constraints the fixer must honour, both carried from the report:**
  (1) `editAffordance.ts` is asserted to be a **LEAF** by a live fence in `WorkflowCanvas.test.tsx`
  — `ownProperty.ts` satisfies it (camelCase, zero imports) but **the fence must be re-read, not
  assumed**; (2) **jsdom cannot see this defect** — it applies no CSS and computes no stacking
  contexts, so a green unit suite is not evidence. **A driven Chrome MCP row is the regression
  check**, exactly as `BUG-260806-01` was closed. Also in scope for the same fast run: the second
  unguarded sink the same sweep found, `frontend/src/lib/providerLogo.tsx:107-108`.

### Operator ratification — 2026-08-07 discussion (D-15 … D-18)

**Six choices were put to the operator in plain language. Four ratified existing decisions
unchanged; two closed items CONTEXT had left to Claude's discretion.** Recording the four
confirmations matters as much as the two new words: D-04's "no escape hatch" was carrying a real
usability cost on Claude's reasoning alone, and it now carries an operator decision instead.

**Ratified unchanged (no edit to the decision text above):**

- **The 189/190 split STANDS** — 189 proves the governance rails while there is nothing to leak;
  190 swaps the no-op for a real MCP call behind an unchanged seam. The operator was shown the
  honest risk (190 is STRETCH and gated, so there is a real path where 189's node never sends at
  all, leaving a step that says "I would have emailed Sarah" and doesn't) and kept the split.
- **D-04 stands — armed, with NO author escape hatch, ever.** Chosen over "armed by default but
  disarmable" and over a per-capability taxonomy, with the cost named: even a harmless external
  action needs a human click.
- **D-05 / D-06 stand** — approve → record intent → run CONTINUES; the workflow publishes and runs.
- **D-10 / D-11 stand** — RECORD the existing MCP-first verdict with a dated re-open trigger; do
  NOT re-validate the 2026-07-24 crawl, and do NOT pull SC#3 out of the phase.

**D-15: the closed capability set is EXACTLY THREE — `send_email`, `create_ticket`,
`post_message`.** No longer Claude's discretion. Chosen over email-only (too thin a canvas
vocabulary) and over adding a fourth (190 has no plan to make a fourth real, so it would ship a
node that can never be connected). **This is the operator's alignment rule made literal: nothing is
built here that 190 cannot later make real.** The `KB_TOOLS` disjointness check in D-03 still
applies and must be verified at planning against all three names.

**D-16: the run-time status word is "Not sent — recorded".** No longer Claude's discretion.
Outcome first, consolation second — it cannot be misread as success, and "recorded" says where the
detail went. Chosen over "Would have sent" (awkward beside past-tense `Done`/`Failed`), "Simulated"
(engineer vocabulary on a business canvas, and silent about whether that was intentional) and
"Recorded only" (reads like a successful log write rather than a withheld send). Renders at all
three surfaces per D-07: canvas node, run surface, phase output.

**⚠ D-17: THE STORED VALUE AND THE RENDERED WORD ARE DIFFERENT THINGS, and migration 115 stores
the SLUG.** The CHECK constraint gains `recorded_not_sent` — a lowercase snake_case literal in the
shape of the five that already exist (`pending, active, completed, failed, skipped`). The sentence
"Not sent — recorded" is what the client's vocabulary layer RENDERS for that slug. Putting display
prose inside a database constraint would make the wording un-editable without a second migration,
would put an em-dash in a CHECK, and would break the shape of the column. **A plan that adds
`'Not sent — recorded'` to `workflow_phases_status_check` has misread this decision.**

**D-18: the badge word is "Not connected", conditional on that state** (this closes the wording
half of D-12, whose placement decision was already locked). Plain, states the gap, implies the fix,
and it retires cleanly — when 190 wires the node up the badge simply stops rendering, which is what
made a state-conditional badge the right call over a type-conditional one. Chosen over "No
destination" (wire vocabulary), "Won't send yet" (duplicates what the run status already says, so
the badge earns less) and spending no badge at all (185's precedent, but it leaves the canvas unable
to say that this step cannot yet reach outside — the card would look identical before and after 190).

### Conflict resolutions — decided at plan-phase, 2026-08-07 (D-19 … D-22)

**`189-RESEARCH.md` §"⚠ CONFLICTS WITH A LOCKED DECISION" measured that TWO locked decisions are
falsified by shipped code, and a third is contradicted by a shipped docblock.** The operator was
unattended and delegated these ("take the decisions"). **No locked decision is re-opened — each
resolution below is the shape that keeps D-03…D-06 ALL true simultaneously.** Each carries the
measurement that forced it.

- **D-19 — resolves CONFLICT 1: the golden run auto-records and continues; arming stays
  undisarmable.** *Measured:* `publish_service._interactive_phase_failures` (`:500-540`) blocks a
  publish pre-run for exactly two shapes — `phase_type == "llm_human_input"` (`:521`) and a
  validator with `on_failure == "ask_user"` (`:531`). The armed action-risk checkpoint is **neither**:
  D-187-01 hoisted it OUT of `phase.validators`, and `harness_engine.py:754` reads
  `action_risk_armed` directly. So an `external_action` phase sails past stage 2.5 into the stage-3
  golden run, hits `timeout_seconds = None if is_action_risk` (`harness_engine.py:1104`) which
  `ask_user_service.subscribe_for_response` documents as *"wait indefinitely"*, and the publish dies
  at `harness_publish_max_seconds = 7200` (`config.py:1184`). **D-06 is FALSE as the tree stands —
  the phase's headline publish test fails RED today.**
  **Decision:** thread `is_golden_run` into the run ctx and make the armed checkpoint
  **auto-record-and-continue** on a golden run — the *pause* is skipped, the **record is not**:
  the phase still writes `recorded_not_sent`. `is_golden_run` already exists as a `workflow_runs`
  column (`db/workflows.py:150,194,203,811`) but is NOT threaded into ctx; **that threading is the
  work.** Rejected: (B) naming armed phases in `_interactive_phase_failures` — that makes an
  `external_action` workflow unpublishable, contradicting D-06 outright; (C) publishing a synthetic
  approval onto the ask channel — it writes a `validator_ask_user_approved` receipt claiming a human
  approved when none did, violating the Control-Room `consequence ≠ receipt` rule. **This class of
  defect (an armed checkpoint killing a run) is `BUG-260731-02`, which is why migration 114 exists —
  so it must be proven by a DRIVEN test, never asserted.**

- **D-20 — resolves CONFLICT 2: a closed `EXTERNAL_ACTION_CAPABILITIES` frozenset that the fidelity
  gate reads and the author-facing rail does NOT.** *Measured:* stage 2.6 rule 2
  (`grounding.py:643-651`) requires every `available_tools` entry to be in `tool_names`, and
  `tool_names` is built at `grounding.py:388` from `get_tools(None)` — the **LLM-facing schema list**,
  not `_TOOL_REGISTRY` (the asymmetry is recorded in `openai_service.py:1133`: *"the inverse of
  render_template — registered in `_TOOL_REGISTRY` but NOT advertised here"*). So the three D-15
  capability names in `available_tools` **block publish at stage 2.6. D-06 is FALSE a second time.**
  **⚠ And the obvious fix opens a governance hole:** `GroundingBundle.tools` (`grounding.py:111,:427`)
  is served on `GET /workflows/grounding-bundle` and bound at `WorkflowBuilderPage.tsx:885` straight
  into `PhaseFormPanel`'s author-facing whitelist rail (`:873`, `:925`) — adding the names to
  `get_tools()` would let an author whitelist `send_email` on an **ordinary, unarmed `llm_agent`
  step**, which is precisely the wire-around D-04 and SC#2 forbid.
  **Decision:** a new closed `EXTERNAL_ACTION_CAPABILITIES: frozenset[str]` in `grounding.py`
  **beside `KB_TOOLS` and in the same shape**, unioned into `tool_names` **for the fidelity check
  only** and deliberately kept OUT of `GroundingBundle.tools`. One home for the closed set, read by
  both the executor (D-02) and the gate; the author-choosable option set does not widen by one entry.
  This mirrors `KB_TOOLS`'s own recorded argument — *"this list DEFINES which steps are governed, so
  a second copy is a safety hole"*. **⚠ It breaks the currently-true identity
  `tools == sorted(tool_names)` asserted in prose at `grounding.py:446-447`; that prose must be
  corrected IN THE SAME COMMIT, with the reason recorded.** The leak itself gets its own test: the
  three names must be absent from `GroundingBundle.tools`.

- **D-21 — resolves CONFLICT 3: `canvasModel.ts:196-203` is a PROSE correction, not a feature.**
  *Measured:* that docblock says verbatim *"`false` is Phase 189's state — an external-action step
  whose checkpoint the author turned off"*. **D-04 makes that state unreachable forever**, and it
  already is: `checkpointOnTarget` (`:274-276`) returns `actionRiskArmed(phase) ? true : undefined`,
  so `false` is not producible from the projection today. **The plan MUST NOT read this docblock as a
  requirement to wire a ghost-detour edge.** The `FlowEdge` `GhostMarks` branch (`FlowEdge.tsx:343`)
  stays shipped and stays unreachable; the docblock simply stops naming 189 as its claimant.

- **D-22 — the capability is a STEP THE EXECUTOR PERFORMS, not a tool the LLM may call.** This is the
  one mechanical question D-03 + D-05 left genuinely open, and RESEARCH §A6 answers it decisively
  with three independent proofs; the shipped precedent is **`render_template`** — a name registered
  in `_TOOL_REGISTRY` and honoured by the whitelist, but never advertised in `get_tools()` and
  executed by the phase itself (`phase_types.py:296-320`). It is the ONLY reading consistent with
  BOTH "rides the existing per-phase tool-whitelist" (D-03) **and** "the executor records the intent"
  (D-05) — and it is what makes D-20's keep-it-off-the-rail shape coherent rather than a special
  case. A plan that hands the three capability names to a model as callable tools has misread this.

### Claude's Discretion

- The 7th `PHASE_GLYPHS` entry — mechanical under the icon convention (see `<code_context>`).
  **⚠ Its home was mis-stated on 2026-08-06 and is corrected below — it is NOT `phaseVocabulary.ts`.
  It is `soulData.ts:43`, and `lib/phaseGlyph.tsx` must be swapped in the SAME commit.**
- The exact phrasing of the phase OUTPUT body (the "would have sent to / subject / NOTHING WAS
  SENT" block) — constrained by `<specifics>`: it must read unmistakably as not-sent, never as a
  receipt.

</decisions>

<verification_2026_08_07>
## Re-verification at refresh — every load-bearing measurement, re-derived

**The standing project rule is to re-derive rather than inherit.** Every figure below was executed
on 2026-08-07, not carried from the 2026-08-06 text.

| Claim (from 2026-08-06) | Command | Result |
|---|---|---|
| D-08: `workflow_phases_status_check` caps status at 5 | `grep -n workflow_phases_status_check supabase/full-schema.sql` | ✅ **HOLDS** — still 5 values, still `:1932` |
| D-08: migration **115** is the next free slot | `ls supabase/migrations/ \| tail` | ✅ **HOLDS** — live head is **114**; 115 free |
| D-01: `PhaseConfig` union has 6 members, a 7th is additive | `sed -n '162,172p' backend/app/models/harness.py` | ✅ **HOLDS** — exactly 6 |
| D-12: badge slot 1 empty + reserved for 189 | `grep -rn "slot 1\|badge slot" src/components/workflows/` | ✅ **HOLDS AND STRENGTHENED** — 5 files + 2 test guards (see D-12) |
| D-12: a third badge is a typecheck error | `phaseNodeCardContract.ts:104` + 188.2-01's control | ✅ **HOLDS** — now control-tested (RED at 34, green at 33) |
| Top-right corner is CLAIMED for the 185 governance seal | `phaseNodeCardContract.ts:196` | ✅ **HOLDS** — verbatim: *"188/189 may not take it"* |
| `PhaseNodeCard.tsx` is 797 L and G-5 firing | `wc -l` | ❌ **FALSE NOW** — **274 L**, G-5 satisfied |
| `PHASE_GLYPHS` lives in `phaseVocabulary.ts` | `grep -rln PHASE_GLYPHS frontend/src` | ❌ **WAS ALREADY FALSE** — see below |

**⚠ ONE CORRECTION THAT PREDATES 188.2 — `PHASE_GLYPHS` was never in `phaseVocabulary.ts`.**
The 2026-08-06 refs pointed at `phaseVocabulary.ts` as "the per-type face maps a 7th type joins".
That is half right — `phaseVocabulary.ts` (641 L) does hold per-type label/sentence maps — but the
**glyph map is `soulData.ts:43`**, a plain `Record<string, string>` with **exactly 6 entries**
(`programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input`, `llm_emit`),
resolved at render by `phaseGlyph()` in `frontend/src/lib/phaseGlyph.tsx`. This error was
inherited, not caused by the refactor — the same class of drift 188.2 found in four
`icon-convention.md` pointers, three of which were already wrong before it moved anything.
**A 7th entry is one additive line in `soulData.ts`, and `phaseGlyph.tsx` must be swapped in the
SAME commit** (`phaseGlyph.tsx:34` states that rule explicitly).

</verification_2026_08_07>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirement
- `.planning/ROADMAP.md` §"Phase 189: Governed External-Action Node Model" — **lines 606-620**
  (⚠ re-derived 2026-08-07; the 2026-08-06 figure of 573-586 shifted when 188.2 was inserted).
  Goal, 4 success criteria, flags. **Line 675** is the G-2 exemption; **line 678** confirms the
  threat model lands with 190. **Line 669** is 189's progress row, already updated to record the
  unblock.
- `.planning/REQUIREMENTS.md` line 59 — CONN-01 verbatim (and CONN-02/03 at 65-66 for what 190 owns).

### The engine seam the node plugs into
- `backend/app/models/harness.py` — the `PhaseConfig` discriminated union (**line 162**, 6 members);
  **read `LlmEmitPhaseConfig`'s docblock first** (lines 144+) — it is the additive-member precedent
  D-01 follows. `action_risk_armed` is at line 235. ⚠ `slug: str` at **line 202** is
  **unconstrained** — no pattern, no enum, no reserved-word list (this is what makes BUG-260807-01
  reachable, and it is worth knowing before adding any slug-keyed lookup).
- `backend/app/services/harness/phase_types.py` — `PHASE_TYPE_REGISTRY_ENTRIES` (line 1658) and
  `register_all()`; the 6 executors a 7th joins. 1681 lines.
- `backend/app/api/runs.py:671` — `resolve_phase_available_tools`, the D-08 server-side re-read
  that makes D-03 work.
- `backend/app/services/harness/grounding.py:797` — `KB_TOOLS` / `KB_TOOLS_SORTED`; the
  `available_tools ∩ KB_TOOLS` detection rule capability names must not collide with.
- `backend/app/services/harness/validator_kinds.py:714` — `action_risk_approval`, `timing="pre"`,
  **always fails by design**: the honest stop D-04 relies on.
- `backend/app/db/workflows.py:120-136` — the `harness_audit` event-type literal set (why D-09
  declines a new event).
- `supabase/full-schema.sql:1932` — `workflow_phases_status_check`, the 5-value cap D-08 amends.
  **Re-verified 2026-08-07: still 5, still that line.**
- `supabase/migrations/114_harness_audit_action_risk_pending.sql` — the shape migration 115 copies.
  **Re-verified: 114 is the live head, so 115 is free.**

### The canvas surface — ⚠ RE-POINTED 2026-08-07 AFTER THE 188.2 CUT

The card is no longer one file. It is a **six-file subtree**, and "read `PhaseNodeCard.tsx`'s
docblock" is no longer sufficient advice. Read the file that owns the fact you need:

- `frontend/src/components/workflows/PhaseNodeCard.tsx` — **274 L** (was 797). The card body
  itself; the `// ── The card ──` separator is at **:106**, so the render body is `:106-274`.
- `frontend/src/components/workflows/phaseNodeCardContract.ts` — **214 L. START HERE FOR D-12.**
  The slot contract and nothing else: the fourteen slots, `BadgeSlot` / `BadgeSlot2Tuple` /
  `BadgeSlots` (`:104`, the max-2 tuple — **a third badge is a TYPECHECK ERROR**),
  `NodeVerdictMark`, `NodeRunStatus`, `PhaseNodeCardProps`. Types-only, zero runtime exports.
  Its own docblock names 189 at `:6-7`; `:196` records that top-right is claimed for governance.
- `frontend/src/components/workflows/NodeCornerMarks.tsx` — **272 L.** The verdict mark (left edge)
  and the ⛨ governance seal (top-right, **not available to 189**).
- `frontend/src/components/workflows/NodeRunOverlay.tsx` — **319 L.** Status ring, arc and pause
  chip. Run mode is a MODE, not a decoration. **D-14 red line: it imports `@/lib/phaseState` as a
  TYPE only** — the card derives no run state.
- `frontend/src/components/workflows/NodeIconWell.tsx` — **167 L.** The 3D mark and its tint —
  **this is where a 7th phase type's glyph renders.** Type colour is a tint behind the icon ONLY.
- `frontend/src/components/workflows/ownProperty.ts` — **86 L, zero imports.** The `own<T>()`
  WR-04 prototype-pollution guard. Any new slug-keyed or type-keyed lookup 189 adds MUST use it.
- `frontend/src/components/workflows/soulData.ts:43` — **`PHASE_GLYPHS`, the single source of
  truth for phase-type glyphs (6 entries).** ⚠ **This corrects the 2026-08-06 refs, which pointed
  at `phaseVocabulary.ts`.** Its render-time resolver is `frontend/src/lib/phaseGlyph.tsx`, and
  `phaseGlyph.tsx:34` requires the two be swapped in the SAME commit.
- `frontend/src/components/workflows/phaseVocabulary.ts` — **641 L.** The per-type label/sentence
  maps (the D-13 ladder's tier-2/tier-3 material) and `groundingCauseOf`. **Not the glyph map.**
- `.claude/skills/sketch-findings-agentic-rag/references/canvas-frame-and-node-anatomy.md` — the
  137-B geometry + badge budget. ⚠ 188.2 made the SKILL's pointers per-fact across the six-file
  subtree; the 248 px / radius-22 / 42-20-20 facts **stayed in the card**, so a blanket "read the
  new modules" would be as wrong as the old blanket "always read `PhaseNodeCard.tsx`".
  `themes/canvas-184.css` is the older 137-D and would draw a card that no longer exists.
- `.claude/skills/sketch-findings-agentic-rag/references/approval-and-review.md` — sketch 144's
  armed-on-by-default finding (names 189 SC#2), the fail-closed `_exec_llm_human_input` timeout
  warning, and the artefact-preview matrix.
- `.claude/skills/sketch-findings-agentic-rag/references/node-vocabulary-and-reveal.md` — 148-C
  ladder + 149-C (the reveal swaps the SUBTITLE; `technicalLine` is Phase 188's).
- `.claude/skills/sketch-findings-agentic-rag/references/graded-governance.md` — the corner seal
  is load-bearing and claims top-right; governance spends no colour and no badge.
- `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §4 — the canvas glyph
  vocabulary; **read before drawing any mark.** ⚠ 188.2 corrected four stale pointers in this file
  (the ⛨ was cited at `PhaseNodeCard.tsx:440` when its true pre-cut home was `:653`, and a
  `definitionOps.ts:388` was cited that **does not exist**) — treat any remaining `:NNN` here as
  needing re-derivation.

### The 188.2 record — read before touching the subtree
- `.planning/phases/188.2-.../188.2-DEFERRED.md` — six deferrals with observable triggers,
  including **D-188.2-DEF-01: the count gate's `failed` line is NOT a usable regression backstop on
  this machine** (`failed` varied 1 → 21 → 50 → 10 → 0 → 0 across eight runs at an identical total
  of 2502 — pre-existing SEED-056 rot). The COUNT columns are sound; the `failed` column is not.
- `.planning/phases/188.2-.../188.2-UAT.md` — **two rows still owed** (see `<deferred>`).

### The connector track (for D-10 / D-11)
- `.planning/seeds/SEED-013-external-integrations-api-mcp.md` and
  `.planning/seeds/SEED-014-automations-routines.md` — the Open-Platform sequencing the verdict
  defers to. **Note:** SEED-031 is the LLM-provider seed, NOT connectors.
- `.planning/research/deep-dive/` — the Beam / Glean / n8n crawl the MCP-first verdict rests on.
- `.planning/prd-reset/DECISIONS.md` — the D-numbered register D-10 adds an entry to.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The whole governance stack already exists.** `action_risk_armed` + `action_risk_approval` +
  the `action_risk_pending` audit event shipped in Phase 185. 189 arms an existing gate on a new
  type; it does not build a checkpoint.
- **The tool whitelist is already server-authoritative.** `resolve_phase_available_tools` re-reads
  from the definition at run time (D-08), so D-03 inherits enforcement for free.
- **The discriminated-union extension is a paved road.** 5 → 6 phase types at 101.1, additive and
  zero-migration on the config side; `_StrictBase` guarantees old rows still validate.
- **The 187 face ladder already computes tier 2 at render** — D-13 fills an existing tier rather
  than adding a mechanism.
- **NEW (188.2): the card's slot contract is a 214-line types-only leaf.** Adding a slot is now a
  small, isolated edit to `phaseNodeCardContract.ts` rather than a change to a 797-line component
  — which is precisely what the refactor was cut for.
- **NEW (188.2): `own<T>()` exists as a zero-import leaf** (`ownProperty.ts`). Any keyed lookup
  189 adds gets its WR-04 guard for one import.

### Established Patterns
- **Closed registries, never dynamic resolution.** `_TOOL_REGISTRY`, `PROGRAMMATIC_PHASE_REGISTRY`,
  `EMITTER_REGISTRY` all share one rule: *a name not present raises*. D-02 must follow it.
- **The two-badge budget is enforced by the type system**, not by review discipline —
  `BadgeSlots` is a max-2 tuple union, now backed by an `@ts-expect-error` control observed RED.
- **No focusable control may live inside the node card** — one tab stop per node; the ✕ and ＋
  live on the lane. Anything 189 adds to the card is non-interactive. **188.2 drove this RED**
  against a planted `<button>` in `NodeCornerMarks.tsx` (5 failures), so the guard is live, not
  aspirational.
- **No per-step-type colour on the card at all** — type colour is a tint behind the ICON ONLY,
  because Phase 188 needs the strong colours for run status.
- **An icon for the same concept is byte-identical everywhere** — a 7th phase-type glyph is ONE
  additive entry in **`soulData.ts:43`** (⚠ corrected), swapped with `lib/phaseGlyph.tsx` in the
  same commit, never per-surface art.
- **Verdict surfaces fail CLOSED** — an unrecognised state is never a pass (the `findIndex → -1`
  fail-open that painted an unknown blocked stage 8/8 green).
- **NEW (188.2): the six-file subtree is fenced by `?raw` source guards.** 17 negative fences plus
  4 haystacks read a six-path `cardSubtreeSource`, and an ESM-cycle fence forbids any destination
  module importing back into `PhaseNodeCard` **in any form** — including the `.tsx`-suffixed
  specifier, which secure-phase found the original fence missed. **A 189 edit that adds a file to
  this subtree must be added to the fence path list, or the fence silently covers less.**

### Integration Points
- `PhaseConfig` union (`harness.py:162`) + `PHASE_TYPE_REGISTRY_ENTRIES` (a 7th executor).
- `available_tools` (D-03) — and the `KB_TOOLS` disjointness check.
- `phaseNodeCardContract.ts` (the slot, D-12) + `soulData.PHASE_GLYPHS` + `lib/phaseGlyph.tsx`
  (the 7th glyph) + `phaseVocabulary.ts` (the D-13 ladder tier 2) + `NodeIconWell.tsx` (where the
  glyph renders).
- `workflow_phases.status` CHECK (migration 115) + every surface that reads a phase status.
- The publish gauntlet's lint path (D-06 — it must NOT block on an unconnected node).

### ⚠ Landmines
- **There is ZERO MCP code in `backend/app`.** "MCP-backed" is a recorded verdict, not existing
  infrastructure. Any plan implying an MCP client exists is wrong.
- **`_exec_llm_human_input` times out at 300s (cap 1800) and returns NORMALLY — the run
  ADVANCES.** An action-risk gate reusing that substrate must fail CLOSED. Carried from the 185
  design record; re-verify before relying on it.
- **`workflow_phases.status` has exactly 5 allowed values** — a 6th is a migration, not a code
  change. **Re-verified 2026-08-07.**
- ~~`PhaseNodeCard.tsx` is G-5 FIRING at 797 L across 4 phases.~~ **RETIRED 2026-08-07** — 274 L,
  ledger reads *satisfied (188.2)*.
- **NEW: the subtree GREW +67.1 % (797 → 1332 L) while the card shrank.** Five new files carry
  their own headers, imports and props types. **Prefer filling an existing slot over adding a
  sixth module** — 189 has no refactor budget and would re-arm G-5 on the directory.
- **NEW: `jsdom` is blind to CSS, stacking contexts and hit-testing in this estate**, and
  `.click()` bypasses hit-testing entirely. Any 189 claim about *reachability*, *occlusion* or
  *visual distinguishability* needs a driven Chrome MCP row with `elementFromPoint` — a green unit
  suite is not evidence. This is how `BUG-260806-01` survived from 184-12 and how
  `BUG-260807-01` survives today.
- **NEW: the app has no URL router** — `ActiveView` is React state at `App.tsx:102`, so visiting
  `/workflows` renders chat and the URL is inert. Relevant to any 189 UAT that assumes deep links.
- **NEW: the count gate's `failed` column is not a regression backstop** (D-188.2-DEF-01). Its
  COUNT columns are sound. Do not read `failed 0` as "no regression".

</code_context>

<specifics>
## Specific Ideas

- The recorded-intent output must read unmistakably as **not sent**. The operator's framing
  throughout was that a recorded intent which reads like a receipt is the failure mode — the same
  instinct behind Phase 188's "State unknown" and the Control Room's `consequence ≠ receipt` rule.
- The migration-115 amendment was chosen **on the 185 precedent specifically**: an honest word is
  a correctness property, not a scoping convenience.
- The badge is spent on the **transient** fact (not connected), not the **invariant** one (armed),
  so it retires cleanly when 190 lands.
- **Added 2026-08-07:** the operator declined to fold an unrelated security fix into this phase
  even though the bug report itself proposed it as "a cheap rider" (D-14). The consistent
  preference across this milestone is that a phase carries its own scope and small fixes go out
  through `/gsd:fast` — the same instinct that produced G-3 and G-7.

</specifics>

<deferred>
## Deferred Ideas

- **A `harness_audit` event for the recorded intent** (D-09) — deferred to **Phase 190**, when the
  receipt would describe a real consequence. Re-open trigger: the first live outbound call.
- **An escape hatch to disarm action-risk on a low-consequence external action** (D-04) — deferred
  to **Phase 190**. Re-open trigger: real usage showing an external capability whose consequence
  genuinely does not warrant approval. Never by loosening this node type.
- **A per-capability risk taxonomy** (the graded third option under D-04) — deferred; 189 has no
  egress to calibrate risk against.
- **Who may extend the closed capability set, and how** — not raised; belongs with 190's
  connector-credential and org-scoping work.
- **How 190 swaps the no-op for a real call without re-authoring** — a 190 planning concern; D-05
  commits only to the seam being unchanged.

### Open bugs reviewed at this discuss-phase and NOT folded (2026-08-07)

- **`BUG-260730-02`** — the emit gate reports missing citations when citations were perfect.
  `affected_areas: [backend/harness, emit/render_template, workflows/publish-gauntlet,
  observability]`. **Not folded.** It is an emit-gate defect, not an external-action-node defect;
  D-06 only requires that a workflow containing the node not be *blocked* from publishing, and
  this bug does not change that. **Re-open trigger:** a 189 workflow containing an
  `external_action` node fails the publish gauntlet with a citation complaint — that would make it
  a 189 blocker rather than a neighbouring defect.
- **`BUG-260731-01`** — the judge-model knob may be inert (env singleton).
  `affected_areas: [backend/harness, workflows/publish-gauntlet, settings, eval/judge,
  observability]`. **Not folded**, same reasoning. **Re-open trigger:** 189 needs to vary the
  judge model to get an `external_action` workflow through the gauntlet's judge hard-wall.
- **`BUG-260609-02`** (`[frontend/panel, harness/sub-agents]`) — reviewed, no overlap with this
  phase's domain. Not folded, no trigger added.

### 188.2 residue riding into this phase (look-while-you're-there, NOT blockers)

- **UAT row A2 ⛔** — needs a live workflow run: read the arc presentation attributes for two
  readings and confirm the seven readings stay distinguishable **by shape alone** in greyscale,
  the running arc spins, and a card with no reading is still. Registered as `D-188.2-DEF-07`.
  **189 will launch live runs (D-06); run A2 on the first one.**
- **UAT row A1's subjective visual half** — zero-cost, one glance at a Builder card.
  Registered as `D-188.2-DEF-08`.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (matched at score 0.6 on generic keywords: "real",
  "milestone", "first") — NL→workflow authoring is Phase 187's territory, already shipped. No
  genuine overlap with the external-action node model. Not folded.

</deferred>

---

*Phase: 189-governed-external-action-node-model*
*Context gathered: 2026-08-06 · Refreshed against the shipped tree: 2026-08-07*
