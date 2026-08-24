# Phase 200: The Run Becomes Measurable — Context

**Gathered:** 2026-08-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 200 makes the workflow run **measurable and legible**: the wire starts carrying per-step
timings and per-step counts, and the four surfaces that consume them — the step panel, the
authoring spine, the canvas and the run surface — are rebuilt to sketch 200's proposed screens.

⚠ **PHASE 200 HAD NO ROADMAP ENTRY WHEN THIS DISCUSSION STARTED.** `gsd-sdk query init.phase-op 200`
returned `phase_found: false`, and it is genuine — not the `#### Phase NNN:` heading quirk. The v3.7
phase table ends at 198 and the last detail heading is `#### Phase 198`. **Scope was therefore
settled in this discussion rather than inherited, and the ROADMAP entry is written FROM this file.**
A planner reading this must treat the decisions below as the scope anchor.

**This phase differs from 199 in two operator-stated ways:**

1. **The presentation-only fence is LIFTED.** Backend changes are in scope. 199's charter —
   *"PRESENTATION ONLY — no data, no endpoint, no migration, no new capability"* — is what made it
   refuse sketch 178's richest sheets correctly and then pass criteria requiring it not to look like
   the sketches. The work was honest; the charter was wrong.
2. **Acceptance is visual match to the sheet, not no-regression.** `ALREADY-SHIPPED` no longer counts
   as a pass. It was **57 of 105 verdicts** in 199 (BUILT 17 · REFUSED/DECLINED/CANNOT-EXPRESS 31 ·
   ALREADY-SHIPPED 57).

**In scope — four screens plus the wire slice:**

| Screen | Sketch id | Ledger rows (build / slice / verify) |
|---|---|---|
| The step panel | `step-panel` | 2 / 2 / 1 |
| The authoring spine (+ the receipt) | `builder-spine` | 3 / 1 / 0 |
| The canvas | `builder-canvas` | 3 / 1 / 0 |
| The run surface | `run-surface` | 0 / 2 / 0 |

**Out of scope — nine screens, deferred to a named follow-on, not dropped:** library · the two doors ·
the draft arrival · the publish gauntlet · the run dialog · the node-identity sheet · the run-panel
sheet · the fork+delete sheet · the connections sheet. Every one is all-blue or all-green (no backend
dependency), so they can ship as a follow-on with no wire risk. See `<deferred>`.

</domain>

<decisions>
## Implementation Decisions

### The acceptance bar

- **D-01 — The bar is a per-screen ELEMENT CHECKLIST derived from the sketch, with two halves.**
  Each screen gets an explicit `MUST RENDER` / `MUST NOT RENDER` inventory of atoms. Verification
  reports `N/N atoms` or **names the miss**. The `MUST NOT RENDER` half is what makes 199-style
  subtractions provable rather than asserted. Worked example, `builder-spine`:

  ```
  MUST RENDER      per-step duration · total runtime · step mark (line, not filled)
  MUST NOT RENDER  "READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) …"
                   "phase_index N"
                   "llm_agent"   (→ the canvas's words: "AI agent step")
  ```

- **D-02 — A checklist atom the shipped component cannot express is resolved BY THE LEDGER'S OWN
  COLOUR, not case by case.** Sketch 200 already assigns every row a colour, so the rule is
  mechanical:

  | Row colour | Verdict |
  |---|---|
  | blue — frontend only | **BUILD** |
  | amber — inside the named backend slice | **BUILD** |
  | amber — outside the slice | **REPORT**, with a named re-open trigger. Never faked, never silently dropped |
  | green — already ships | **VERIFY, do not rebuild** |

  This is what bounds the phase: it is a rule that can be pointed at, rather than a judgement per row.

- **D-03 — The checklist is derived in plan `200-01`, which modifies ZERO source files.** It is
  committed **before** any source change, so `git diff --name-only` over that commit is the proof
  rather than a promise. Later plans **cite row ids and may not edit the checklist**; an atom that
  moves afterwards is a **deviation to explain**, never a quiet edit. This mirrors the
  characterization-baseline discipline the repo already trusts —
  `WorkflowDoorSwitch.baseline.test.tsx`'s docblock: *"A baseline taken after the edit proves the
  edit against itself."*

- **D-04 — The checklist opens with §0 KNOWN SKETCH DEFECTS, each with the correction written in.**
  A checklist derived verbatim would turn the sketch's own recorded nits into acceptance criteria.
  Every one is excluded **by name**, with what the atom should be instead:

  | Drawn | Use instead |
  |---|---|
  | spine fork lanes: `Confirm the QBR before rendering` / `Fill the QBR template` (pre-rename names) | the current step names |
  | draft card footer: `How long it looks back` ×2 | `Open in the builder` / `See the steps` |
  | connections sheet: gstatic `stitch-placeholder-300x300.svg` ×9 | `@lobehub/icons` via `providerLogo.tsx` (`icon-convention.md` §1) |
  | run surface: **no NOW capture exists** | the screen has no shipped-half to compare against |

  200-01 adds any further defects it finds to the same section.

### The wire slice — timings and counts

- **D-05 — Per-step timing needs NEW COLUMNS. Measured, not assumed.** `workflow_phases` already has
  `created_at` / `updated_at` and **neither can yield a duration**:
  - all phases are **batch-INSERTed at run creation** (`backend/app/db/workflows.py:334`), so
    `created_at` is the same instant for every row in a run;
  - every transition writes `updated_at=now()` at **six sites** (`active`, `completed`, `failed`,
    `skipped`, `recorded_not_sent`, `cancelled` — `db/workflows.py:1441,1483,1505,1517,1548,1597`),
    so `updated_at` survives only as the LAST transition and the `active` stamp is overwritten by
    the completion.

  → add `started_at` and `completed_at`, written at those six existing sites. **Two columns, not one
  `duration_ms`:** duration is computed client-side, and timestamps additionally give "when did this
  happen", a live-ticking running step, a true total-runtime span, and time-spent-waiting-to-start.

- **D-06 — "never ran" and "not recorded" MUST render differently.** This repo has learned the same
  lesson twice (`runFacts.ts`'s four arms after CR-01; `DecisionsList`'s three arms under D-20):
  folding an absence together with a negative is the defect, and a boolean cannot express it.

  ```
  pending    → renders nothing            (hasn't run yet)
  skipped    → renders nothing            (never ran — correct silence, not absence)
  active     → ticks live from started_at
  completed  → 12.4s
  cancelled  → ran 8.1s, interrupted
  historic row (status=completed, both timestamps NULL)
             → "time not recorded"        ← a DIFFERENT render from "never ran"
  ```

  **No backfill.** A backfill from `updated_at` is correct only where the completion was the last
  write to the row, is silently wrong elsewhere, and nothing on the row would say which — and
  `started_at` would stay NULL regardless, so no duration could be shown anyway.

- **D-07 — A per-step COUNT is declared by the phase type, and ONLY where a count is already a fact
  in its output.** Bounded to the eight shipped phase types. A retrieval step already knows how many
  sources came back; a batch-agents step knows how many agents ran — those emit `{count, noun}`. A
  type with no real number **emits nothing, and the UI then renders nothing** — never `0`, never a
  dash (the `SEED-159` honesty rule).

  ⚠ **Domain-neutral by construction — this is the `SEED-168` axis.** The noun is the step's own,
  never the contract's. The sheet's `312 docs matched` / `48 fields extracted` are DOMAIN sentences;
  reproducing that phrasing by having the model author the number would ship the fabricated business
  figure `199-05` called *"the highest-consequence lie this phase could ship"* — refused there, and
  refused here.

  ⚠ **Deriving a count structurally from the existing `output` jsonb was REJECTED and the reason is
  measured:** `_persist_output` (`harness_engine.py:142`) stores each executor's dict **full and
  inline, never truncated** (CR-02), the shapes differ per phase type, and **no key marks "the thing
  produced"** — so any structural count would be the length of whichever key happened to be a list.

- **D-08 — The canvas edge label and the live per-step count are ONE mechanism.** Sheet c1's
  `312 contracts → 48 extracted → 12 flagged` is the upstream step's declared count rendered on the
  connection. The canvas does not get its own counting path. An edge whose upstream step declared no
  count **renders no label**, per D-07.

- **D-09 — The receipt is the same spine re-read in the PAST TENSE.** One component, two tenses — not
  a third surface. Each row: the step, its outcome, its duration, its count if it declared one, and
  its deliverable if it produced one. Total runtime at the top. Everything on it is now a measured
  fact rather than a claim, which is precisely what the slice buys.

  ```
  Ran 4m 12s · 6 steps · finished 14:22

  ✓ Find the contracts      1.8s    312 found
  ✓ Pull the key terms      2m 04s  48 extracted
  ✓ Check them              1m 51s
  — Escalate exceptions     never ran (skipped)
  ✓ Write the summary       19s     report.docx
  ```

  ⚠ **Past-tense words come from `libraryVocabulary.ts`'s register, NOT `runVocabulary.ts`'s** — the
  hot-file ledger already records that these are different audiences (a whole PAST run vs one step
  being watched) and that copying one into the other is the defect.

  This closes COVERAGE.md's *"c3's receipt column is missing"* — one component on a screen that
  already exists, which is why COVERAGE listed it as a revision rather than its own screen.

### The human gate

- **D-10 — An unanswered `llm_human_input` step PAUSES the run. It must never approve.**
  Measured in `BUG-260816-06`: `HumanInputConfig.timeout_seconds` defaults to **300**
  (`backend/app/models/harness.py:135`), and `backend/app/services/harness/phase_types.py:818-856`
  initialises `answer = ""` then assigns it **only inside the `kind == "response"` branch** — so the
  timeout path falls straight through to a normal completion. Four of five real runs of
  `doc_qa_scoped_098uat` completed their approval step with `answer: ""` at exactly the 5-minute mark.

  On timeout: the phase stays unfinished and the run flips to **`paused`** — a status that
  **already ships** in the run status vocabulary beside `cap_paused`. Answering later still resumes;
  nothing is discarded. This is FORWARD-CHECK #6's recorded intent, *"unanswered must stop, not
  approve"*, and it is why the run surface can render a human step honestly at all.

  ⚠ **`fail_phase` was rejected**: it discards completed upstream work, so stepping away for six
  minutes would mean losing the run rather than resuming it.

### Pins and G-5

- **D-11 — `PhaseFormPanel.test.tsx`'s ABSOLUTE-ZERO hook pin is honoured by EXTRACTION, never
  re-baselined.** Any state sheet c4's `MODEL` / `GROUNDING` / `EXTERNAL ACTION` card sections need
  lives in a new leaf; the panel's own source stays hook-free and the pin passes **unedited** —
  proof rather than promise. Precedent: `199-06` created `FieldGuidance.tsx` for exactly this and the
  pin passed untouched.

  ⚠ **The honest cost, stated rather than discovered: leaf sprawl.** 199 already added one leaf; if
  all three card sections need disclosure state, that is three more. Accepted deliberately — the
  alternative removes the only guard keeping a 1290-line panel that fires G-5 at 10 phases from
  absorbing state.

- **D-12 — `WorkflowDoorSwitch.baseline.test.tsx` is NOT in this phase's blast radius.** The scope
  decision deferred the doors screen, so `WorkflowDoorSwitch.tsx` is untouched and its byte-for-byte
  pin is never approached. **This was flagged as a blocker in the phase kickoff and the scope
  decision dissolved it — recorded so nobody plans a re-baseline that is not needed.**

- **D-13 — G-5 on `phase_types.py` is discharged by EXTRACTING THE HUMAN-INPUT EXECUTOR as the
  vehicle for its own fix.** Re-derived 2026-08-19: **39 commits / 16 phases / 2424 lines**,
  disposition *"extraction due"*, never taken. This phase touches it in **two different concerns**
  (every type declares a count; the human-gate timeout branch changes behaviour) — which is exactly
  what G-5 exists to catch. The human-input executor moves to its own module in the same act as the
  D-10 fix. Precedent: `backend/app/api/threads.py` → `run_transport.py` (extraction TAKEN 2026-08-17).

  The counts change **stays in place** — it is one additive line per type across all eight, not a
  second concern.

- **D-14 — G-5 verdicts for the rest, re-derived from git on 2026-08-19 rather than read from the
  ledger.** ⚠ **Two ledger cells were already STALE when checked** — `PhaseFormPanel.tsx` read
  `21 / 10 / 1289` and measures `22 / 10 / 1290`; `WorkflowCanvas.tsx` read `25 / 7 / 1405` and
  measures `26 / 7 / 1390` (**lines went DOWN — 199 subtracting, which is the desirable direction**).

  | File | commits / phases / lines | Verdict |
  |---|---|---|
  | `frontend/src/components/workflows/WorkflowCanvas.tsx` | 26 / 7 / 1390 | honoured by construction |
  | `frontend/src/components/workflows/PhaseFormPanel.tsx` | 22 / 10 / 1290 | honoured by construction + D-11 |
  | `frontend/src/components/panel/WorkspacePanel.tsx` | 16 / 10 / 646 | honoured by construction |
  | `frontend/src/components/panel/PhaseCard.tsx` | 12 / 8 / 543 | honoured by construction |
  | `frontend/src/pages/WorkflowRunPage.tsx` | 15 / 5 / 1197 | honoured by construction |
  | `frontend/src/components/workflows/PhaseSpineGraph.tsx` | 4 / 4 / 278 | honoured by construction |
  | `backend/app/services/harness/phase_types.py` | 39 / 16 / 2424 | **extraction TAKEN — D-13** |
  | `backend/app/db/workflows.py` | 38 / 19 / 1889 | honoured by construction |
  | `frontend/src/lib/api.ts` | 174 / 99 / 6357 | **decline HOLDS — see below** |
  | `backend/app/api/workflow_runs.py` | 3 / 3 / 260 | **at threshold, and it has NO LEDGER ROW** |

- **D-15 — The `api.ts` decline from Phase 197 HOLDS, and its re-open trigger does NOT fire.** The
  trigger is verbatim *"the next phase adding a RUNTIME export or a second concern here."* This phase
  adds fields to the `WorkflowRunPhase` **interface** — a TYPE, with zero new runtime exports — so
  `196-08`'s mock-factory failure mode (nine suites throwing at mount because a mock did not declare
  a newly-added export) measurably cannot fire. Same posture as 192.2. **The planner must verify this
  by grep over the real diff, not by quoting this paragraph.**

- **D-16 — `backend/app/api/workflow_runs.py` OWES A HOT-FILE LEDGER ROW, added in the SAME COMMIT
  that modifies it.** It measures `3 / 3 / 260` — **exactly at the G-5 threshold**, which is the
  `libraryRow.ts` / `doorVocabulary.ts` state where a missing row costs most. It carries
  `WorkflowRunPhaseRead` (the wire model this phase extends) and its serializer at line 238.
  Per CLAUDE.md's **same-commit sync rule**, the row in the CLAUDE.md scan list and the section in
  `docs/HOT-FILE-LEDGER.md` land together. **A row without a section, or a section without a row, is
  drift.**

### Folded bug reports

All four are folded into Phase 200 (`status: folded`, `folded_into: 200`):

- **`BUG-260610-01`** — the run timer resets on navigation (**re-opened 2026-08-16** after a 194.1
  fold claim was withdrawn). Cause: the timer starts at component mount. **D-05's `started_at` is
  structurally the fix** — a duration derived from a server timestamp cannot reset. ⚠ **The report
  also carries a DUPLICATE-AVATAR half that this phase does not address**; that half stays open.
- **`BUG-260813-01`** — the canvas stays dark in light mode (`WorkflowCanvas.tsx`, `useTheme`). The
  canvas is being rebuilt in `200-05`; a theme bug on a surface under re-presentation is cheapest to
  close while it is open.
- **`BUG-260807-01`** — NaN transform from a prototype key; **`BUG-260808-01`** — node-position
  lookup on a prototype slug. Both tagged `security/WR-04`. Correctness defects under the rebuilt
  canvas. ⚠ **Neither is a checklist row** — they widen `200-05` beyond D-01 deliberately, which the
  planner must budget for rather than discover.
- **`BUG-260816-06`** — the silent approval. Closed by **D-10**.

### Claude's Discretion

- Plan boundaries and wave sequencing within the six-plan shape, subject to CLAUDE.md's **dispatch at
  most TWO plans concurrently** rule and `GSD_VITEST_MAX_WORKERS=2`.
- The migration number and file name under `supabase/migrations/`, following `<digits>_name.sql`.
- Whether the new timestamps reach the client on the SSE emit stream, on fetch reconcile, or both —
  subject to **D-v2.5-03** (Realtime is a best-effort hint, always reconcile via fetch) and to
  `196`'s measured failure where a live-SSE lock with no fetch reconcile hid a shipped control.
- The exact `{count, noun}` field naming on the wire.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The sketch — this phase's acceptance bar
- `.planning/sketches/200-journey-interactive/README.md` — why it exists, the four operator
  corrections, the known nits (D-04's source), the measured Stitch tool limits
- `.planning/sketches/200-journey-interactive/index.html` — the prototype AND the machine-readable
  ledger. **The `JOURNEY` array (lines ~117-228) is the source D-01/D-02 derive from** — every row
  carries `what` / `needs` (`none` | `frontend` | `data` | `capture`) / `note`
- `.planning/sketches/200-journey-interactive/FORWARD-CHECK.md` — decisions this design must not
  contradict; **#6 is the human-gate finding behind D-10**
- `.planning/sketches/200-journey-interactive/COVERAGE.md` — sheet-by-sheet vs sketch 178; the
  receipt-column gap behind D-09
- `.planning/sketches/200-journey-interactive/PROMPTS.md` — the generality rule + the motion/icon rules
- `.planning/sketches/200-journey-now/DESIGN-journey.md` — the design language the screens inherit
- `.planning/sketches/200-journey-now/` — the six real captures of the shipped product

### The prior phase, and why its charter was wrong
- `.planning/ROADMAP.md` → `#### Phase 199: The Component Map` — the presentation-only charter,
  verbatim, and its ten-sheet scope table
- `.planning/phases/199-the-component-map/199-VERIFICATION.md` — 5/5 on its own criteria
- `.planning/phases/199-the-component-map/199-UAT.md` + `199-HUMAN-UAT.md` — the verdict tables
  behind BUILT 17 / REFUSED 31 / ALREADY-SHIPPED 57

### Backend — the wire slice
- `backend/app/api/workflow_runs.py` — `WorkflowRunPhaseRead` (line 76) and its serializer (line 238).
  ⚠ **The route declares a `response_model`, which DROPS UNDECLARED KEYS SILENTLY** — 192.2's
  measured lesson on `api/workflows.py`: a green db test beside an unchanged UI. Drive the route
  through a real `TestClient`.
- `backend/app/db/workflows.py` — the batch INSERT (line 334) and all six transition writes
  (1441, 1483, 1505, 1517, 1548, 1597)
- `backend/app/services/harness/phase_types.py:765-856` — the human-input executor, the D-13
  extraction target and the D-10 fix site
- `backend/app/models/harness.py:135` — `HumanInputConfig.timeout_seconds: int = 300`
- `backend/app/services/harness_engine.py:142` — `_persist_output`, the CR-02 full-inline policy
  behind D-07's rejection of structural counting
- `supabase/migrations/058_workflow_phases.sql` — the table, its RLS 2-hop FK chain, and the
  `updated_at` trigger
- `supabase/migrations/119_workflow_phases_cancelled.sql` — ⚠ **the status constraint ARRAY is the
  AUTHORITY on the status set, never the prose in `WorkflowRunPhaseRead`'s docstring**, which was
  wrong for a whole phase

### Frontend — the four screens
- `frontend/src/components/workflows/PhaseFormPanel.tsx` + `PhaseFormPanel.test.tsx` (**the
  absolute-zero hook pin, D-11**) + `PhaseFormPanel.rails.test.tsx`
- `frontend/src/components/workflows/PhaseSpineGraph.tsx` — ⚠ the AUTHORING spine: it reads a DRAFT
  definition and **has no run**, so any run-time word on it is a fabricated claim (199-02 refused
  exactly that)
- `frontend/src/components/workflows/WorkflowCanvas.tsx` · `FlowEdge.tsx` · `CanvasToolbar.tsx`
- `frontend/src/pages/WorkflowRunPage.tsx` — ⚠ **carries the no-previewer fence** (see D-17)
- `frontend/src/components/panel/PhaseTimeline.tsx` · `PhaseCard.tsx` · `phaseStatusMeta.ts`
- `frontend/src/lib/api.ts:4172-4235` — `WorkflowRunPhase` and `WorkflowRunRead`
- `frontend/src/components/workflows/library/runFacts.ts` — **the four-arm precedent behind D-06**;
  `hasOwnProperty.call`, never `?? fallback`
- `frontend/src/components/workflows/library/libraryVocabulary.ts` — the past-tense register D-09 draws from

### Project rules
- `CLAUDE.md` → *Workflow guardrails* (G-1…G-7 + the hot-file ledger scan list) · *Parallel
  execution* (`GSD_VITEST_MAX_WORKERS=2`, bootstrap-worktree, never `rm -rf` a worktree) ·
  *UAT scoreboard recipe* (the full native roster + OpenRouter)
- `docs/HOT-FILE-LEDGER.md` — the named seam and binding invariants for every file above.
  **D-16 adds a section here for `api/workflow_runs.py` in the same commit as its row.**
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — the project sketch-findings skill;
  `references/icon-convention.md` §1 (single-sourced brand marks) and §4 (canvas glyph vocabulary)
- `.planning/reported-bugs/` — the four folded reports named in `<decisions>`

### Seeds that bind or were routed
- `.planning/seeds/SEED-148-workflow-output-files-not-surfaced.md` — ⚠ **trigger FIRED at this phase
  and the seed's `status: open` is STALE**; see D-17
- `.planning/seeds/SEED-168-*` — planning from one instance builds a risk-register feature (D-07)
- `.planning/seeds/SEED-159-*` — an unfound field renders explicit absence, never a silent blank (D-06)
- `.planning/seeds/SEED-155-*` — a sketch drew an atom the shipped component could not render
- `.planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md` — the five flaky
  suites and the triage procedure. ⚠ **Do NOT reach for the cap when the gate reds**
- `.planning/seeds/SEED-185-*` — no router, zero addressable URLs (why `← Workflows` is the only way back)
- `.planning/seeds/SEED-152-*` — confidence on phase outputs; would add an atom to every step row

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets — the phase composes far more than it creates
- **`panel/FilePreview.tsx`** — a capable full-replace drill-in previewer: markdown →
  `MarkdownRenderer`, code → `ShikiCode`, csv → `CsvTablePreview`, text → `<pre>`, images → signed
  URL, and a calm *"No preview available · Download"* arm for binary/too-large. Ships with
  `VersionDiff` / `DiffLines` / `DiffExpandOverlay`. **See D-17 — it stays out of this phase.**
- **`components/files/FileRow.tsx` + `fileRowUtils.ts` + `lib/fileIcon.tsx`** — the ONE row markup
  behind all three file surfaces, already consumed by `WorkflowRunPage.tsx` at `density="run"`.
  ⚠ `FileRow` **must forward its ref to the caller-supplied child** or the panel's roving focus dies
  silently; a MISSING `created_at` must sort **FIRST**.
- **The run status vocabulary already contains `paused`** beside `cap_paused` — D-10 needs no new
  literal on `workflow_runs.status`.
- **`workflow_phases.output` jsonb** already exists and is populated full-inline per phase — D-07's
  counts ride in it rather than needing a column.
- **`modelFitness.ts`, the governance dial and the readiness contract all already exist** — sheet c4
  asks for them to be *composed into a card shape*, not built.

### Established patterns that constrain this phase
- **Extraction as the vehicle for a fix** — `threads.py` → `run_transport.py` (2026-08-17). D-13.
- **Characterization capture must PREDATE the change** — 188.1's most expensive lesson, re-proved in
  188.2, 192-06, 192-08 and 192.2-02. D-03 applies it to the checklist itself.
- **Absence gets its own arm** — `runFacts.ts` (four arms), `DecisionsList` (three arms, D-20),
  `ModelField`'s `noAnswer`. D-06.
- **One home per concern, and one string home per surface** — `doorVocabulary.ts`,
  `libraryVocabulary.ts`, `decisionsVocabulary.ts`, `runVocabulary.ts`. D-09 must not cross them.
- **`hasOwnProperty.call`, never `TABLE[key] ?? fallback`** — a coalesce returns `constructor`
  (`runFacts.ts`, `modelFitness.ts`).
- **Blocking I/O never inside an async handler** — wrap with `run_in_threadpool` (D-v2.5-01).
- **Migrations ship as numbered SQL under `supabase/migrations/`, applied by pasting into the
  Supabase SQL editor** — never `db push` / `db reset` — then `bash scripts/regenerate-full-schema.sh`.

### Integration points
- `db/workflows.py`'s six transition writes ← D-05's `started_at` / `completed_at`
- `phase_types.py`'s eight executors ← D-07's `{count, noun}`; its human-input executor ← D-10 + D-13
- `api/workflow_runs.py`'s `WorkflowRunPhaseRead` + serializer ← the new wire fields (⚠ `response_model`
  drops undeclared keys silently)
- `lib/api.ts`'s `WorkflowRunPhase` interface ← the type-only mirror (D-15)
- `PhaseTimeline` / `PhaseCard` / `PhaseSpineGraph` / `WorkflowCanvas` / `WorkflowRunPage` ← the render

</code_context>

<specifics>
## Specific Ideas

- **The operator's sequencing instruction, verbatim:** *"one backend slice first — WorkflowRunPhase
  gains timestamps and per-step counts, which clears 4 of the 7 amber rows — then step panel → spine
  → canvas."* The ledger's seven amber rows resolve as: the slice clears the **spine's per-step
  timings**, the **run surface's execution trace**, the **run surface's live per-step counts** and
  the **canvas connection payload label** (four). The three that remain are `Locked by Alex M.`
  (lock-holder attribution is not on the wire), `Will overwrite 1,200 records` (no row count is
  computed anywhere) and the **fan-out router**, which is drawn dashed and tagged `NOT BUILT` because
  the spine is LINEAR by recorded decision — building it would design past a decision nobody has taken.

- **The shape of the phase, as approved:**
  ```
  200-01  derive the checklist        (source diff MUST be empty)
  200-02  backend: timestamps + counts + the human-gate pause + the executor extraction
  200-03  the step panel
  200-04  the spine (+ the receipt)
  200-05  the canvas
  200-06  the run surface
  ```

- **`llm_judge_rubric` ships in the backend with NO glyph.** `PHASE_GLYPHS` in `soulData.ts` has
  seven keys and the backend has eight phase types. Found by the sketch's forward sweep — a real
  product gap, not a sketch problem. It surfaces wherever a judge step renders; note it in whichever
  screen's checklist first meets it rather than letting it be re-discovered.

- **`external_action` is ALREADY a first-class node kind** — the vocabulary reserved its seat before
  the sketch began. A connection node is not a future bolt-on.

</specifics>

<deferred>
## Deferred Ideas

### The nine screens not in Phase 200
All are all-blue or all-green — **no backend dependency**, so they carry no wire risk and can ship as
a follow-on. **Re-open trigger for every one: the follow-on phase to 200 being scoped.**

| Screen | Rows | Note |
|---|---|---|
| library | 1 blue · 1 green | the blue row IS `library-card-state-word-renders-twice-on-colliding-row` (open) |
| the two doors | 2 blue · 1 green | includes the knowledge picker's three states; **`WorkflowDoorSwitch.baseline.test.tsx` lives here** |
| the draft arrival | 1 blue · 2 green | the three components already ship; never drawn into the journey |
| the publish gauntlet | 2 blue · 1 green | the 9-pip strip is drawn in **EMOJI**, which the adopted language forbids outright |
| the run dialog | 1 blue · 1 green | `This workflow expects: kickoff_prompt` needs an authored label per input key — deferred by `199-10` with a named trigger |
| the node-identity sheet | 2 blue · 1 amber · 1 green | where `llm_judge_rubric`'s missing glyph belongs |
| the run-panel sheet | 1 blue · 1 green | ask card, paused cue, file preview, version diff |
| fork + delete | **3 green — all of it already ships** | verify-only under D-02; the graded guard ladder is measured correct |
| **the connections sheet** | 3 blue · 1 green | ⚠ **not merely deferred — it is a MILESTONE.** `SEED-144` (provider-shaped, one account many capabilities), `SEED-145` (platform assets, usable in chat AND workflows), `SEED-146` (**EVERY capability is a WRITE** — never a bare toggle). No MCP client exists in the backend today |

### D-17 — the document viewer on the workflow surface
Raised by the operator during this discussion. **Measured rather than assumed, and the finding
inverted the question twice:**

1. The viewer **exists and is capable** — `panel/FilePreview.tsx` (see `<code_context>`).
2. It is reachable **only from chat**: one mount at `FilesSection.tsx:245`, inside `WorkspacePanel`,
   which itself has **exactly one production mount — `ChatLayout.tsx:673`**. No workflow page mounts
   either. (This is the cross-surface-shell property: a change to the panel lands in CHAT first.)
3. Its absence from the run page is a **TESTED DECISION, not a gap.** `WorkflowRunPage.test.tsx`
   carries an active fence — *"promises no preview: the previewer is neither imported nor named"* —
   with the reason recorded verbatim: *"DOCX/PPTX/XLSX/PDF are download-only by decision and the
   template engine emits .docx, so the flagship deliverable is exactly the artefact that cannot be
   shown in place. Req 7 asks that it be listed and downloadable — not that it be rendered."*
   **That fence STANDS.** Mounting the previewer would buy little: the most common workflow output is
   the one format it cannot render.
4. ⚠ **`SEED-148`'s run-surface half is ALREADY CLOSED and the seed's `status: open` is STALE by a
   phase.** Phase 195 shipped it: `WorkflowRunPage.tsx:63` imports `FileRow`, line 625 wires
   `downloadWorkspaceFile`, lines 1143-1177 render at `density="run"`, and both empty-state strings
   ship (`No files yet — this run hasn't written anything.` / `This run produced no files.`). Under
   D-02 this is a **green row: verify, do not rebuild.**

**Decision:** Phase 200 takes **nothing new** here — it verifies the shipped listing as a green row.
**What genuinely remains open in `SEED-148` is the CANVAS half and the WORKFLOW-PANEL half**, plus a
third case the seed does not cover: **`PendingAskCard` has no file affordance at all** — it previews a
draft's TEXT behind a faded mask (`PendingAskCard.tsx:56-94`), so a human-input step asking a person
to approve a GENERATED DOCUMENT has nothing to open. That last one would need the ask to carry its
artefact on the wire — a further backend concern, deliberately not stacked on this phase's three.

**Action owed:** correct `SEED-148`'s frontmatter — record that its trigger fired at Phase 200, that
the run-surface half was closed by Phase 195, and that the canvas + panel + ask-card halves remain
open with the follow-on named. Related and untouched: `SEED-161` (in-app document **editing** —
explicitly NOT this milestone), `SEED-110` (run-time template/file upload), `SEED-169` (RunCard's file
badge reads 0 for a real deliverable), `SEED-170` (two shipped comments credit `OutputFileCard` for
work it does not do).

### Amber rows the slice cannot clear — REPORT under D-02, with triggers
- **`Locked by Alex M.`** — lock-holder attribution is not on the wire. Re-open when a phase scopes
  lock ownership.
- **`Will overwrite 1,200 records`** — no row count is computed anywhere; a preflight count is a
  capability, not a label. Re-open with the connections/approval milestone (`SEED-146`).
- **The fan-out router** — the spine is LINEAR by recorded decision; drawn dashed and tagged
  `NOT BUILT`. Re-open only as a deliberate revisit of the linear commitment.
- **The run surface's NOW capture** — needs a live run to photograph honestly. Re-open when a run can
  be driven for capture.

### Bug halves explicitly NOT taken
- **`BUG-260610-01`'s duplicate-avatar half** — the timer half is folded (D-05); the avatar half stays
  open on the report.
- **`BUG-260815-06`** (structural gate refusal names nothing actionable) — the publish gauntlet is out
  of scope. Re-open trigger: the follow-on phase, which includes that screen.
- **`library-card-state-word-renders-twice`** — the library screen is out of scope. Same trigger.
- **`BUG-260816-03`** (thread-row identity / folder-chip truncation) — navigation and chat-list, not
  this journey.

### Not designed for, and why — carried from FORWARD-CHECK
- **Scheduling / automations** (`SEED-014`) — the product cannot schedule anything, and `SEED-167`
  records that a scheduler over stateless runs produces disconnected reports anyway.
- **Branching / looping** — a recorded linear commitment.
- **Self-hosted inference as a deployment mode** (`SEED-173`) — no surface in this journey.
- **`SEED-151`** (Projects as a real container) — would turn the library's `Project` select from a
  filter into navigation. Do not over-invest in that control as filter chrome.
- **`SEED-167`** (incremental / stateful runs) — the step panel would need *"start from what last time
  produced"* and the run surface would need to show what carried forward. Measured absent: zero
  occurrences of `previous_run` / `last_run_output` in the harness.

</deferred>

---

*Phase: 200-the-workflow-journey*
*Context gathered: 2026-08-19*
