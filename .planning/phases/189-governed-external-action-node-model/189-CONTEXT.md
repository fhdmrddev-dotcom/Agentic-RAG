# Phase 189: Governed External-Action Node Model - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning — **but see the G-5 gate below: Phase 188.2 ships FIRST.**

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
D-14 (the Deep path stays byte-identical) · UI hint yes · **G-2 does NOT fire** — ROADMAP line
641 exempts 189 by name as "the design/decision phase".

**⚠ ONE FLAG IS AMENDED BY THIS DISCUSSION: "no migration" → migration 115.** See D-08.
</domain>

<gate>
## ⚑ G-5 GATE — Phase 188.2 ships BEFORE this phase

**G-5 fires on `frontend/src/components/workflows/PhaseNodeCard.tsx`, and it was measured, not
inherited:** `wc -l` = **797 lines**; `git log -- <file>` shows **4 distinct phases** (184, 185,
188, 188.1), over the 3-phase threshold. 189 adds a node type, which lands on that file.

**Operator decision (2026-08-06):** insert a dedicated behaviour-preserving refactor phase
**188.2** on `PhaseNodeCard.tsx` BEFORE 189 executes — the 188.1 shape (a verbatim extraction,
measured, zero user-visible change, lean prove-unchanged UAT).

**Sequencing rationale, recorded because it inverts the usual order:** this discussion ran
BEFORE the refactor deliberately. A blind extraction is the one that gets re-opened; 188.2 now
knows which seams 189 needs (a 7th phase type's face, a conditional badge in slot 1, a
capability-derived subtitle) and can cut accordingly.

**Fold candidate for 188.2, not 189:** `BUG-260806-01` (a selected card occludes its own ✕ —
xyflow `z-index: 1000` vs the portal's `auto`; pre-existing, found while driving 188.1's board;
`affected_areas: [frontend/workflow-canvas, frontend/editing-affordances]`).
</gate>

<decisions>
## Implementation Decisions

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
  than on the type.** **Verified in the shipped source, not inherited:** `PhaseNodeCard.tsx`'s
  docblock states *"188 spends ZERO badge slots: slot 1 is still empty and still reserved for
  Phase 189"* — so 189 holds the **last free word-badge** on the card. It is spent on the one
  fact the card cannot otherwise carry: this step reaches outside and is not wired to anything
  yet. The armed-for-approval fact is invariant for the type (a badge that is always present on
  a type is really part of the type), and 185 set the precedent by spending **no badge at all**
  on governance — it used the corner seal, and deleted `nodePresentation.GROUNDING_TONE`.
  **Because the badge is conditional on state, it retires cleanly when 190 connects the node.**

- **D-13: The vocabulary ladder's middle tier is CONFIG-DERIVED from the chosen capability** —
  "Sends an email", "Creates a ticket" — falling back to a generic type sentence only when no
  capability is chosen yet. This is precisely what tier 2 of the **148-C layered ladder** exists
  for (author name → config-derived → type sentence, **computed at render, never stored**), and
  it is the fix for the measured VOCAB-02 failure: only **10 of 119** phases carry a `phase.name`,
  so the generic sentence is what users actually see.

### Claude's Discretion

- The exact membership and naming of the closed capability set (D-02) — constrained to align with
  190's email / JIRA / Slack slice and to stay disjoint from `KB_TOOLS`.
- The exact status word for D-07 and the badge word for D-12 — constrained by the vocabulary
  rules recorded under `<code_context>`.
- The 7th `PHASE_GLYPHS` entry — mechanical under the icon convention (see `<code_context>`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirement
- `.planning/ROADMAP.md` §"Phase 189: Governed External-Action Node Model" (lines 573-586) — goal,
  4 success criteria, flags. **Line 641** is the G-2 exemption; **line 644** confirms the threat
  model lands with 190.
- `.planning/REQUIREMENTS.md` line 59 — CONN-01 verbatim (and CONN-02/03 at 65-66 for what 190 owns).

### The engine seam the node plugs into
- `backend/app/models/harness.py` — the `PhaseConfig` discriminated union; **read
  `LlmEmitPhaseConfig`'s docblock first** (lines 144+) — it is the additive-member precedent D-01
  follows. `action_risk_armed` is at line 235.
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
- `supabase/migrations/114_harness_audit_action_risk_pending.sql` — the shape migration 115 copies.

### The canvas surface
- `frontend/src/components/workflows/PhaseNodeCard.tsx` — **read the docblock before drawing
  anything.** The slot contract, the max-2 `BadgeSlots` tuple (a third badge is a TYPECHECK
  ERROR), and the explicit reservation of slot 1 for Phase 189. 797 L — **and the target of the
  188.2 refactor that ships first.**
- `frontend/src/components/workflows/phaseVocabulary.ts` — the per-type face maps a 7th type
  joins (641 L).
- `.claude/skills/sketch-findings-agentic-rag/references/canvas-frame-and-node-anatomy.md` — the
  137-B geometry + badge budget. **The shipped card is 137-B; `themes/canvas-184.css` is the older
  137-D and would draw a card that no longer exists — always read `PhaseNodeCard.tsx`.**
- `.claude/skills/sketch-findings-agentic-rag/references/approval-and-review.md` — sketch 144's
  armed-on-by-default finding (names 189 SC#2), the fail-closed `_exec_llm_human_input` timeout
  warning, and the artefact-preview matrix.
- `.claude/skills/sketch-findings-agentic-rag/references/node-vocabulary-and-reveal.md` — 148-C
  ladder + 149-C (the reveal swaps the SUBTITLE; `technicalLine` is Phase 188's).
- `.claude/skills/sketch-findings-agentic-rag/references/graded-governance.md` — the corner seal
  is load-bearing and claims top-right; governance spends no colour and no badge.
- `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §4 — the canvas glyph
  vocabulary; **read before drawing any mark.** Phase-type icons = the single-source `PHASE_GLYPHS`.

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

### Established Patterns
- **Closed registries, never dynamic resolution.** `_TOOL_REGISTRY`, `PROGRAMMATIC_PHASE_REGISTRY`,
  `EMITTER_REGISTRY` all share one rule: *a name not present raises*. D-02 must follow it.
- **The two-badge budget is enforced by the type system**, not by review discipline —
  `BadgeSlots` is a max-2 tuple union. A third badge does not get flagged; it does not compile.
- **No focusable control may live inside the node card** — one tab stop per node; the ✕ and ＋
  live on the lane. Anything 189 adds to the card is non-interactive.
- **No per-step-type colour on the card at all** — type colour is a tint behind the ICON ONLY,
  because Phase 188 needs the strong colours for run status.
- **An icon for the same concept is byte-identical everywhere** — a 7th phase-type glyph is ONE
  additive entry in the shared `PHASE_GLYPHS` map, never per-surface art.
- **Verdict surfaces fail CLOSED** — an unrecognised state is never a pass (the `findIndex → -1`
  fail-open that painted an unknown blocked stage 8/8 green).

### Integration Points
- `PhaseConfig` union + `PHASE_TYPE_REGISTRY_ENTRIES` (a 7th executor).
- `available_tools` (D-03) — and the `KB_TOOLS` disjointness check.
- `phaseVocabulary.ts` + `PHASE_GLYPHS` + `PhaseNodeCard.tsx`'s `badges` slot (D-12/D-13).
- `workflow_phases.status` CHECK (migration 115) + every surface that reads a phase status.
- The publish gauntlet's lint path (D-06 — it must NOT block on an unconnected node).

### ⚠ Landmines measured during this discussion
- **There is ZERO MCP code in `backend/app`.** "MCP-backed" is a recorded verdict, not existing
  infrastructure. Any plan implying an MCP client exists is wrong.
- **`_exec_llm_human_input` times out at 300s (cap 1800) and returns NORMALLY — the run
  ADVANCES.** An action-risk gate reusing that substrate must fail CLOSED. Carried from the 185
  design record; re-verify before relying on it.
- **`workflow_phases.status` has exactly 5 allowed values** — a 6th is a migration, not a code change.
- **`PhaseNodeCard.tsx` is G-5 FIRING at 797 L across 4 phases.** 188.2 pays it down first.

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

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (matched at score 0.6 on generic keywords: "real",
  "milestone", "first") — NL→workflow authoring is Phase 187's territory, already shipped. No
  genuine overlap with the external-action node model. Not folded.

</deferred>

---

*Phase: 189-governed-external-action-node-model*
*Context gathered: 2026-08-06*
