# Phase 200: The Run Becomes Measurable - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-19
**Phase:** 200-the-workflow-journey
**Areas discussed:** The acceptance bar · Per-step counts and timings · Phase scope · Pins and G-5 · (operator-raised) the document viewer

---

## Pre-discussion findings surfaced before any question

- **Phase 200 had no ROADMAP entry.** `init.phase-op 200` → `phase_found: false`, genuine (the v3.7
  table ends at 198). Scope was therefore settled in discussion rather than inherited.
- **G-2 discharged** — sketch 200 is committed (`64fc84cb`), `acceptance_bar: true`.
- **G-5 fires on ten target files**; surfaced as required by the orchestrator protocol.
- **The backend slice was measured, not assumed:** `workflow_phases` has `created_at`/`updated_at`,
  all phases are batch-INSERTed at run creation, and every transition overwrites `updated_at` — so
  per-step duration is genuinely underivable today. The operator's proposed sequence held.
- **Reported-bugs cross-check** (MANDATORY touchpoint): eight open `surface: Agentic-RAG` reports
  overlap the phase domain; three are named inside the sketch itself.

---

## The acceptance bar

### Q1 — What is the acceptance bar checked against, and by whom?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-screen element checklist derived from the sketch | MUST-RENDER / MUST-NOT-RENDER inventory per screen; goes red mechanically | ✓ |
| Operator eyeball, side-by-side at 1440×900 | Highest fidelity to the judgement no checklist caught, but cannot block a plan | |
| Both — checklist gates the plan, the operator's eye gates the phase | Two gates catching different things | |

**User's choice:** Per-screen element checklist.
**Notes:** The MUST-NOT-RENDER half is what makes 199-style subtractions provable rather than
asserted. → **D-01**.

### Q2 — An atom turns out to be unexpressable. What happens now the fence is lifted?

| Option | Description | Selected |
|--------|-------------|----------|
| Build if blue or inside the named backend slice; REPORT otherwise | Bounded by the ledger's own colour coding | ✓ |
| Build it — the fence is lifted, so anything drawn gets built | Pulls in the connections milestone, lock ownership, a preflight row count | |
| Report everything unexpressable; build only the slice | Re-creates 199's outcome for the 21 blue rows | |

**User's choice:** Colour-driven rule.
**Notes:** The selected preview also settled green rows — *verify, don't rebuild* — which later made
the `SEED-148` finding a no-cost verification rather than new work. → **D-02**.

### Q3 — When is the checklist derived, and what makes it binding?

| Option | Description | Selected |
|--------|-------------|----------|
| One derivation plan first, committed before any source change | `git diff --name-only` over that commit is the proof; later plans cite and cannot edit | ✓ |
| Derived per-plan, inside each plan's first task | Checklist and change land together — proves the edit against itself | |
| Derived up front, then operator review before building | Adds a sign-off gate on ~13 screens of rows | |

**User's choice:** Source-free derivation plan `200-01`.
**Notes:** Mirrors `WorkflowDoorSwitch.baseline.test.tsx`'s recorded discipline. → **D-03**.

### Q4 — How are the sketch's own known defects handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded by name in a §0 section, each with the correction written in | Nothing imported blind; no Stitch re-run needed | ✓ |
| Re-run the affected screens in Stitch first | MCP generate fails 100% for the assistant; every re-run is an operator paste | |
| Derive verbatim; correct during the build | The gate loses meaning exactly where the sketch was weakest | |

**User's choice:** §0 KNOWN SKETCH DEFECTS with corrections. → **D-04**.

---

## Per-step counts and timings

### Q1 — Where does a per-step count come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Each phase type declares a count only where one is already a fact in its output | Bounded to 8 types; nothing rendered where there is no number | ✓ |
| Derive structurally from the existing `output` jsonb | Shapes differ per type; no key marks "the thing produced" | |
| The model writes the sentence — "312 docs matched" | The fabricated business figure `199-05` refused | |

**User's choice:** Declared per phase type.
**Notes:** Measured first — `_persist_output` stores each executor's dict full and inline (CR-02),
which is what rules out structural counting. Domain-neutral by construction, closing the `SEED-168`
risk. → **D-07**, and **D-08** (the canvas edge label is the same mechanism, not a second one).

### Q2 — What does a step's timing render in each state, including existing runs with no timestamps?

| Option | Description | Selected |
|--------|-------------|----------|
| Two columns; "never ran" and "not recorded" render DIFFERENTLY | Duration computed client-side; total runtime and wait-to-start fall out free | ✓ |
| Two columns plus a backfill from `updated_at` where derivable | Right for some rows, silently wrong for others, and nothing says which | |
| One `duration_ms` column written at completion | Cannot tick live, cannot say when, cannot give a true span | |

**User's choice:** Two columns, no backfill, distinct absence arms.
**Notes:** Framed against the repo's twice-learned lesson (`runFacts.ts`'s four arms after CR-01;
`DecisionsList`'s three under D-20). → **D-05**, **D-06**.

### Q3 — What is the run's receipt (sheet c3's third column, missing entirely)?

| Option | Description | Selected |
|--------|-------------|----------|
| The same spine re-read in the past tense, with duration, count and deliverable per row | One component, two tenses; everything on it is now a measured fact | ✓ |
| A compact receipt — total runtime, outcome, deliverable only | Drops the per-step timings the slice was built to expose | |
| No receipt in this phase — name it and defer | COVERAGE.md already lists it as a revision, not its own screen | |

**User's choice:** Past-tense spine.
**Notes:** Words come from `libraryVocabulary.ts`'s register, not `runVocabulary.ts`'s — different
audiences. The chosen preview's last row (`report.docx`) later made the `SEED-148` question
half-answered already. → **D-09**.

---

## Phase scope

### Q1 — Is Phase 200 the whole journey, or the data-led slice?

| Option | Description | Selected |
|--------|-------------|----------|
| The four data-touching screens behind the backend slice — six plans | One phase, one argument; the nine remaining screens carry no backend risk | ✓ |
| The whole journey minus connections — 12 screens | ~25 build rows plus a migration; bigger than 199, which had no backend | |
| Split — 200 is the wire, 201 is the visual work | Cleanest verification, but 200 would close with zero visible change | |

**User's choice:** Four screens + wire slice + derivation plan = six plans.
**Notes:** Row counts per screen were derived from the sketch's `JOURNEY` array and reconciled to the
published 21 / 7 / 13 / 1 totals before the question was asked.

### Q2 — Which open bug reports fold into Phase 200? *(multi-select)*

| Option | Description | Selected |
|--------|-------------|----------|
| `BUG-260610-01` — run timer resets on navigation | `started_at` is structurally the fix | ✓ |
| `BUG-260813-01` — canvas stays dark in light mode | Canvas is being rebuilt in `200-05` | ✓ |
| `BUG-260807-01` + `BUG-260808-01` — canvas prototype-key defects | Correctness, not checklist rows; widens `200-05` | ✓ |
| `BUG-260816-06` — human approval times out into a silent approval | Run surface renders human steps; the fix is harness behaviour | ✓ |

**User's choice:** All four folded.
**Notes:** The duplicate-avatar half of `BUG-260610-01` is explicitly NOT taken.

### Q3 — What should an unanswered human step do instead of silently approving?

| Option | Description | Selected |
|--------|-------------|----------|
| Pause the run and wait — `paused` already ships in the status vocabulary | No auto-approval ever; answering later still resumes | ✓ |
| Fail the phase with a named reason | Discards completed upstream work; stepping away loses the run | |
| Record the timeout honestly but keep proceeding | An unattended approval still approves — a governance property, not a display one | |

**User's choice:** Pause.
**Notes:** Measured first — `timeout_seconds: int = 300` at `models/harness.py:135`, and
`phase_types.py:818-856` initialises `answer = ""` outside the response branch. Matches
FORWARD-CHECK #6's recorded intent. → **D-10**.

---

## Pins and G-5

### Q1 — Policy for `PhaseFormPanel.test.tsx`'s absolute-zero hook pin

| Option | Description | Selected |
|--------|-------------|----------|
| Extract around it — new state lives in a new leaf, pin untouched | 199-06's precedent (`FieldGuidance.tsx`); pin passes unedited | ✓ |
| Re-baseline deliberately in a source-free commit that predates the change | Auditable, but removes the only guard on a 1290 L file firing G-5 at 10 phases | |
| Extract around it AND take the G-5 refactor on the panel first | G-5's real remedy, but +1 plan and the phase grows | |

**User's choice:** Extract around it.
**Notes:** Leaf sprawl was stated as the accepted cost, not discovered later. `WorkflowDoorSwitch.baseline.test.tsx`
had been flagged as a second blocker in the kickoff — the scope decision removed it from the blast
radius entirely. → **D-11**, **D-12**.

### Q2 — G-5 on `phase_types.py`, which this phase touches in two concerns

| Option | Description | Selected |
|--------|-------------|----------|
| Extract the human-input executor as the vehicle for its own fix | Fix and extraction become one act; `threads.py` → `run_transport.py` precedent | ✓ |
| Honoured by construction — record the override and move on | Continues a 16-phase deferral | |
| Take the full `phase_types.py` extraction first | Large change on the execution path, ahead of work that doesn't need it | |

**User's choice:** Extract the human-input executor.
**Notes:** Two files resolved without a question — `api.ts`'s 197 decline holds (type-only change, no
runtime export, trigger does not fire), and `api/workflow_runs.py` owes a ledger row regardless.
Triples were re-derived from git; two ledger cells were already stale. → **D-13**, **D-14**, **D-15**, **D-16**.

---

## Operator-raised: the document viewer inside the workflow

Raised after the four areas, before context was written: *"the document viewer inside the workflow …
used to open the files that are generated and needs human input … do we have the seed."*

### Q — How much of `SEED-148` does Phase 200 take?

| Option | Description | Selected |
|--------|-------------|----------|
| Show and download the deliverable on the run surface — keep the previewer out | The 195 download-only fence stands; its recorded reason holds | ✓ |
| Also mount the previewer for formats it CAN render | Retires a tested fence; `WorkflowRunPage` fires G-5 at 15/5/1197 | |
| Also give the human-input step a file to open | A third backend concern; the ask carries no file data today | |
| None of it — record that the trigger fired and route it | Nothing silently ignored, but the run surface still hides the deliverable | |

**User's choice:** Show and download on the run surface; previewer stays out.

**⚠ Correction delivered after the choice, from measurement:** Phase 195 **already shipped** the
run-surface listing and download (`WorkflowRunPage.tsx:63`, `:625`, `:1143-1177`, both empty-state
strings). `SEED-148`'s `status: open` is stale by a phase. Under **D-02** this makes it a **green
row — verify, don't rebuild** — so the choice stands and costs nothing. What genuinely remains open
is the canvas half, the workflow-panel half, and a case the seed does not cover: `PendingAskCard`
has no file affordance at all. → **D-17**.

---

## Claude's Discretion

- Plan boundaries and wave sequencing within the six-plan shape (subject to ≤2 concurrent plans and
  `GSD_VITEST_MAX_WORKERS=2`).
- Migration number and filename under `supabase/migrations/`.
- Whether new timestamps reach the client over SSE, on fetch reconcile, or both — subject to
  D-v2.5-03 and to 196's measured live-SSE-lock failure.
- Exact `{count, noun}` field naming on the wire.

## Deferred Ideas

- The **nine screens** not in scope, each with the same re-open trigger (the follow-on to 200) — and
  the **connections sheet** flagged as a milestone rather than a screen (`SEED-144`/`145`/`146`).
- Three amber rows the slice cannot clear: lock-holder attribution, the preflight row count, the
  fan-out router — plus the run surface's missing NOW capture.
- Bug halves not taken: `BUG-260610-01`'s duplicate avatar, `BUG-260815-06`, the library
  state-word duplication, `BUG-260816-03`.
- `SEED-148`'s canvas + panel halves, and the `PendingAskCard` file affordance.
- `llm_judge_rubric` ships with no `PHASE_GLYPHS` key — noted for whichever screen first meets it.
- Carried from FORWARD-CHECK and untouched: `SEED-014` scheduling, branching/looping, `SEED-151`
  Projects-as-container, `SEED-167` incremental runs, `SEED-152` phase-output confidence,
  `SEED-161` in-app editing, `SEED-173` self-hosted inference.
