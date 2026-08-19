# Phase 200: The Run Becomes Measurable — Research

**Researched:** 2026-08-19
**Domain:** FastAPI + asyncpg + Supabase/Postgres wire slice (per-phase timestamps + declared counts) → React/TS render across four workflow surfaces
**Confidence:** HIGH on everything measured in-repo (every claim below carries a `file:line` or a command output). LOW on nothing — where a thing could not be measured it is written `NOT MEASURED`.

---

## Summary

Phase 200 is **one backend slice and four render surfaces**, and the slice is smaller than it looks while the *plumbing around it* is larger than CONTEXT.md assumes. The timestamps themselves are two nullable `timestamptz` columns and seven one-word SQL edits. What is genuinely non-trivial, and is not budgeted anywhere in CONTEXT.md, is:

1. **There are SEVEN phase-status write sites, not six** (`db/workflows.py:1649`, `cancel_active_phases`, is the missed one) — and the batch INSERT is an eighth site if `pending` rows are to carry anything.
2. **`workflow_runs.status = 'paused'` has ZERO writers in the entire backend** — it is admitted by the CHECK constraint and read by three queries, and nothing has ever written it. D-10 therefore needs a NEW db writer, a NEW `PhaseOutcome` kind, a NEW engine arm, and a **resume trigger that does not exist today** (the only re-drive path in the product is the boot-time sweep).
3. **`llm_judge_rubric` is a VALIDATOR kind, not a phase type.** There are **seven** phase types and `PHASE_GLYPHS` has exactly seven keys. The "seven glyphs, eight types — a real product gap" claim in CONTEXT `<specifics>`, in the ROADMAP, and in the sketch's FORWARD-CHECK is **refuted by measurement**. D-07's "bounded to the eight shipped phase types" should read seven.
4. **`api/workflow_runs.py` narrows the phase read in TWO places** — the Pydantic model *and* the PostgREST `.select("slug, phase_index, status")` at `:230`. And the shipped test's `_FakeQuery.select()` is a **no-op that ignores its column list**, so the existing suite structurally *cannot* catch a forgotten `.select()` widening. That is 192.2's silent-drop lesson with the safety net removed.
5. **`BUG-260807-01` and `BUG-260808-01` are already CODE-FIXED.** Both sinks route through `own()` today. What is owed is **one driven browser row with a seeded fixture** — a UAT row, not a repair. CONTEXT tells the planner to "budget for it rather than discover it"; the budget is far smaller than that wording implies.

**Primary recommendation:** plan `200-02` as **two waves inside one plan-slot** — wave A the additive, low-risk half (migration + 7 write sites + widened reads + widened wire model + `{count, noun}` on the four types that have a real number), wave B the human-gate pause, which is a behaviour change to the engine's control flow and needs its own RED-first proof. Do **not** let the extraction (D-13) ride wave A; it is the vehicle for wave B by explicit decision, and mixing it with the additive half destroys the "changes no behaviour beyond the human-gate fix" acceptance criterion in SC#5.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-step start/finish instants | **Database / Storage** (`workflow_phases` columns) | Backend (7 UPDATE sites) | Only the server observes a transition; a client clock cannot. `BUG-260610-01` is exactly the bug you get when the client owns it. |
| Duration arithmetic + live tick | **Browser / Client** | — | D-05 stores two timestamps, not a `duration_ms`. Client computes; a running step ticks from `started_at`. `@/lib/fmtElapsed` already exists as the ONE shared formatter. |
| Per-step count declaration | **API / Backend** (`phase_types.py` executors) | Database (`workflow_phases.output` jsonb) | Only the executor knows what its own number MEANS. D-07 forbids deriving it structurally, and `harness_engine.py:142` `_persist_output` stores the dict full-inline so the jsonb is a viable carrier. |
| Count → words on screen | **Browser / Client** | — | The noun is data, the sentence is vocabulary. Same split `runVocabulary.ts` already keeps (derivation vs words). |
| Canvas edge label | **Browser / Client** | — | D-08: the edge reads the *upstream node's* already-declared count via the existing `runState?: (slug) => NodeRunState \| undefined` seam (`WorkflowCanvas.tsx:567`). No second counting path, no new fetch. |
| Human-gate pause | **API / Backend** (engine control flow) | Database (`workflow_runs.status`) | A pause is a run-lifecycle decision. The client only renders it. |
| Resume-after-pause | **API / Backend** (⚠ **does not exist**) | — | See §B8 — the only re-drive today is `main.py`'s boot sweep. |
| The receipt | **Browser / Client** | — | D-09: one component, two tenses. It reads facts the slice already put on the wire. |

---

## Project Constraints (from CLAUDE.md)

Directives that bind this phase, extracted verbatim in substance:

| # | Directive | Where it bites Phase 200 |
|---|---|---|
| C-1 | Python backend must use a `venv` | Every backend command in a plan must be `backend/venv/Scripts/python.exe -m ...` |
| C-2 | No LangChain / LangGraph — raw SDK only | Inert here |
| C-3 | All tables need RLS | `workflow_phases` RLS is a 2-hop FK chain (see §B5). **Adding columns does not change policies** — verify no policy touches column lists. |
| C-4 | **Migrations ship as numbered SQL under `supabase/migrations/`, `<digits>_name.sql`, applied by PASTING INTO THE SUPABASE SQL EDITOR — never `db push` / `db reset`**, then `bash scripts/regenerate-full-schema.sh` (no `--reset`), never hand-edit `full-schema.sql` | `200-02` owns migration **121** (next free — see §B5). The apply is an operator action and should be its own serialized step, the way `194-12` was. |
| C-5 | Never run blocking I/O directly in an async handler — wrap with `run_in_threadpool` | `api/workflow_runs.py` already routes every call through `aexec`; keep it. |
| C-6 | Supabase Realtime is a best-effort hint — **always reconcile via fetch** (D-v2.5-03) | Claude's Discretion item on SSE-vs-fetch: the answer is **both, with fetch authoritative**. 196's measured failure (a live-SSE lock with no fetch reconcile hid a shipped control) is the standing counter-example. |
| C-7 | `GSD_VITEST_MAX_WORKERS=2`; dispatch **at most TWO** plans concurrently; bootstrap every worktree with `scripts/bootstrap-worktree.sh`; **never `rm -rf` a worktree** | Applies to every plan. |
| C-8 | **Serialize any plan whose tests MUTATE the local database** | See §D19 — `test_migration_119.py` connects to real `:54322`. A new `test_migration_121.py` will too. That plan may not run concurrently with another DB-touching plan. |
| C-9 | Hot-file ledger **same-commit sync rule**: a row in CLAUDE.md and a section in `docs/HOT-FILE-LEDGER.md` land together | D-16 (`api/workflow_runs.py`). **§C11 finds three MORE files owing rows** — see the correction list. |
| C-10 | UAT scoreboard recipe: full native roster + OpenRouter (8 rows), derived from `MODEL_CAPABILITIES`, never re-typed | Applies — this phase touches the agent loop's phase executors. See §F. |
| C-11 | `node scripts/check-claude-md-size.cjs` before/after any CLAUDE.md edit | D-16's row edit triggers this. |
| C-12 | Provider-docs-first when work touches a specific provider | **Not triggered.** Nothing in this phase is provider-specific — the count declaration is per phase TYPE, not per provider. Stated explicitly so the planner does not spend a task on it. |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The acceptance bar**

- **D-01 — The bar is a per-screen ELEMENT CHECKLIST derived from the sketch, with two halves.** Each screen gets an explicit `MUST RENDER` / `MUST NOT RENDER` inventory of atoms. Verification reports `N/N atoms` or **names the miss**. The `MUST NOT RENDER` half is what makes 199-style subtractions provable rather than asserted. Worked example, `builder-spine`:

  ```
  MUST RENDER      per-step duration · total runtime · step mark (line, not filled)
  MUST NOT RENDER  "READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) …"
                   "phase_index N"
                   "llm_agent"   (→ the canvas's words: "AI agent step")
  ```

- **D-02 — A checklist atom the shipped component cannot express is resolved BY THE LEDGER'S OWN COLOUR, not case by case.** Sketch 200 already assigns every row a colour, so the rule is mechanical:

  | Row colour | Verdict |
  |---|---|
  | blue — frontend only | **BUILD** |
  | amber — inside the named backend slice | **BUILD** |
  | amber — outside the slice | **REPORT**, with a named re-open trigger. Never faked, never silently dropped |
  | green — already ships | **VERIFY, do not rebuild** |

  This is what bounds the phase: it is a rule that can be pointed at, rather than a judgement per row.

- **D-03 — The checklist is derived in plan `200-01`, which modifies ZERO source files.** It is committed **before** any source change, so `git diff --name-only` over that commit is the proof rather than a promise. Later plans **cite row ids and may not edit the checklist**; an atom that moves afterwards is a **deviation to explain**, never a quiet edit. This mirrors the characterization-baseline discipline the repo already trusts — `WorkflowDoorSwitch.baseline.test.tsx`'s docblock: *"A baseline taken after the edit proves the edit against itself."*

- **D-04 — The checklist opens with §0 KNOWN SKETCH DEFECTS, each with the correction written in.** A checklist derived verbatim would turn the sketch's own recorded nits into acceptance criteria. Every one is excluded **by name**, with what the atom should be instead:

  | Drawn | Use instead |
  |---|---|
  | spine fork lanes: `Confirm the QBR before rendering` / `Fill the QBR template` (pre-rename names) | the current step names |
  | draft card footer: `How long it looks back` ×2 | `Open in the builder` / `See the steps` |
  | connections sheet: gstatic `stitch-placeholder-300x300.svg` ×9 | `@lobehub/icons` via `providerLogo.tsx` (`icon-convention.md` §1) |
  | run surface: **no NOW capture exists** | the screen has no shipped-half to compare against |

  200-01 adds any further defects it finds to the same section.

**The wire slice — timings and counts**

- **D-05 — Per-step timing needs NEW COLUMNS. Measured, not assumed.** `workflow_phases` already has `created_at` / `updated_at` and **neither can yield a duration**:
  - all phases are **batch-INSERTed at run creation** (`backend/app/db/workflows.py:334`), so `created_at` is the same instant for every row in a run;
  - every transition writes `updated_at=now()` at **six sites** (`active`, `completed`, `failed`, `skipped`, `recorded_not_sent`, `cancelled` — `db/workflows.py:1441,1483,1505,1517,1548,1597`), so `updated_at` survives only as the LAST transition and the `active` stamp is overwritten by the completion.

  → add `started_at` and `completed_at`, written at those six existing sites. **Two columns, not one `duration_ms`:** duration is computed client-side, and timestamps additionally give "when did this happen", a live-ticking running step, a true total-runtime span, and time-spent-waiting-to-start.

- **D-06 — "never ran" and "not recorded" MUST render differently.** This repo has learned the same lesson twice (`runFacts.ts`'s four arms after CR-01; `DecisionsList`'s three arms under D-20): folding an absence together with a negative is the defect, and a boolean cannot express it.

  ```
  pending    → renders nothing            (hasn't run yet)
  skipped    → renders nothing            (never ran — correct silence, not absence)
  active     → ticks live from started_at
  completed  → 12.4s
  cancelled  → ran 8.1s, interrupted
  historic row (status=completed, both timestamps NULL)
             → "time not recorded"        ← a DIFFERENT render from "never ran"
  ```

  **No backfill.** A backfill from `updated_at` is correct only where the completion was the last write to the row, is silently wrong elsewhere, and nothing on the row would say which — and `started_at` would stay NULL regardless, so no duration could be shown anyway.

- **D-07 — A per-step COUNT is declared by the phase type, and ONLY where a count is already a fact in its output.** Bounded to the eight shipped phase types. A retrieval step already knows how many sources came back; a batch-agents step knows how many agents ran — those emit `{count, noun}`. A type with no real number **emits nothing, and the UI then renders nothing** — never `0`, never a dash (the `SEED-159` honesty rule).

  ⚠ **Domain-neutral by construction — this is the `SEED-168` axis.** The noun is the step's own, never the contract's. The sheet's `312 docs matched` / `48 fields extracted` are DOMAIN sentences; reproducing that phrasing by having the model author the number would ship the fabricated business figure `199-05` called *"the highest-consequence lie this phase could ship"* — refused there, and refused here.

  ⚠ **Deriving a count structurally from the existing `output` jsonb was REJECTED and the reason is measured:** `_persist_output` (`harness_engine.py:142`) stores each executor's dict **full and inline, never truncated** (CR-02), the shapes differ per phase type, and **no key marks "the thing produced"** — so any structural count would be the length of whichever key happened to be a list.

- **D-08 — The canvas edge label and the live per-step count are ONE mechanism.** Sheet c1's `312 contracts → 48 extracted → 12 flagged` is the upstream step's declared count rendered on the connection. The canvas does not get its own counting path. An edge whose upstream step declared no count **renders no label**, per D-07.

- **D-09 — The receipt is the same spine re-read in the PAST TENSE.** One component, two tenses — not a third surface. Each row: the step, its outcome, its duration, its count if it declared one, and its deliverable if it produced one. Total runtime at the top. Everything on it is now a measured fact rather than a claim, which is precisely what the slice buys.

  ```
  Ran 4m 12s · 6 steps · finished 14:22

  ✓ Find the contracts      1.8s    312 found
  ✓ Pull the key terms      2m 04s  48 extracted
  ✓ Check them              1m 51s
  — Escalate exceptions     never ran (skipped)
  ✓ Write the summary       19s     report.docx
  ```

  ⚠ **Past-tense words come from `libraryVocabulary.ts`'s register, NOT `runVocabulary.ts`'s** — the hot-file ledger already records that these are different audiences (a whole PAST run vs one step being watched) and that copying one into the other is the defect.

  This closes COVERAGE.md's *"c3's receipt column is missing"* — one component on a screen that already exists, which is why COVERAGE listed it as a revision rather than its own screen.

**The human gate**

- **D-10 — An unanswered `llm_human_input` step PAUSES the run. It must never approve.** Measured in `BUG-260816-06`: `HumanInputConfig.timeout_seconds` defaults to **300** (`backend/app/models/harness.py:135`), and `backend/app/services/harness/phase_types.py:818-856` initialises `answer = ""` then assigns it **only inside the `kind == "response"` branch** — so the timeout path falls straight through to a normal completion. Four of five real runs of `doc_qa_scoped_098uat` completed their approval step with `answer: ""` at exactly the 5-minute mark.

  On timeout: the phase stays unfinished and the run flips to **`paused`** — a status that **already ships** in the run status vocabulary beside `cap_paused`. Answering later still resumes; nothing is discarded. This is FORWARD-CHECK #6's recorded intent, *"unanswered must stop, not approve"*, and it is why the run surface can render a human step honestly at all.

  ⚠ **`fail_phase` was rejected**: it discards completed upstream work, so stepping away for six minutes would mean losing the run rather than resuming it.

**Pins and G-5**

- **D-11 — `PhaseFormPanel.test.tsx`'s ABSOLUTE-ZERO hook pin is honoured by EXTRACTION, never re-baselined.** Any state sheet c4's `MODEL` / `GROUNDING` / `EXTERNAL ACTION` card sections need lives in a new leaf; the panel's own source stays hook-free and the pin passes **unedited** — proof rather than promise. Precedent: `199-06` created `FieldGuidance.tsx` for exactly this and the pin passed untouched.

  ⚠ **The honest cost, stated rather than discovered: leaf sprawl.** 199 already added one leaf; if all three card sections need disclosure state, that is three more. Accepted deliberately — the alternative removes the only guard keeping a 1290-line panel that fires G-5 at 10 phases from absorbing state.

- **D-12 — `WorkflowDoorSwitch.baseline.test.tsx` is NOT in this phase's blast radius.** The scope decision deferred the doors screen, so `WorkflowDoorSwitch.tsx` is untouched and its byte-for-byte pin is never approached. **This was flagged as a blocker in the phase kickoff and the scope decision dissolved it — recorded so nobody plans a re-baseline that is not needed.**

- **D-13 — G-5 on `phase_types.py` is discharged by EXTRACTING THE HUMAN-INPUT EXECUTOR as the vehicle for its own fix.** Re-derived 2026-08-19: **39 commits / 16 phases / 2424 lines**, disposition *"extraction due"*, never taken. This phase touches it in **two different concerns** (every type declares a count; the human-gate timeout branch changes behaviour) — which is exactly what G-5 exists to catch. The human-input executor moves to its own module in the same act as the D-10 fix. Precedent: `backend/app/api/threads.py` → `run_transport.py` (extraction TAKEN 2026-08-17).

  The counts change **stays in place** — it is one additive line per type across all eight, not a second concern.

- **D-14 — G-5 verdicts for the rest, re-derived from git on 2026-08-19 rather than read from the ledger.** ⚠ **Two ledger cells were already STALE when checked** — `PhaseFormPanel.tsx` read `21 / 10 / 1289` and measures `22 / 10 / 1290`; `WorkflowCanvas.tsx` read `25 / 7 / 1405` and measures `26 / 7 / 1390` (**lines went DOWN — 199 subtracting, which is the desirable direction**).

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

- **D-15 — The `api.ts` decline from Phase 197 HOLDS, and its re-open trigger does NOT fire.** The trigger is verbatim *"the next phase adding a RUNTIME export or a second concern here."* This phase adds fields to the `WorkflowRunPhase` **interface** — a TYPE, with zero new runtime exports — so `196-08`'s mock-factory failure mode (nine suites throwing at mount because a mock did not declare a newly-added export) measurably cannot fire. Same posture as 192.2. **The planner must verify this by grep over the real diff, not by quoting this paragraph.**

- **D-16 — `backend/app/api/workflow_runs.py` OWES A HOT-FILE LEDGER ROW, added in the SAME COMMIT that modifies it.** It measures `3 / 3 / 260` — **exactly at the G-5 threshold**, which is the `libraryRow.ts` / `doorVocabulary.ts` state where a missing row costs most. It carries `WorkflowRunPhaseRead` (the wire model this phase extends) and its serializer at line 238. Per CLAUDE.md's **same-commit sync rule**, the row in the CLAUDE.md scan list and the section in `docs/HOT-FILE-LEDGER.md` land together. **A row without a section, or a section without a row, is drift.**

**Folded bug reports**

All four are folded into Phase 200 (`status: folded`, `folded_into: 200`):

- **`BUG-260610-01`** — the run timer resets on navigation (**re-opened 2026-08-16** after a 194.1 fold claim was withdrawn). Cause: the timer starts at component mount. **D-05's `started_at` is structurally the fix** — a duration derived from a server timestamp cannot reset. ⚠ **The report also carries a DUPLICATE-AVATAR half that this phase does not address**; that half stays open.
- **`BUG-260813-01`** — the canvas stays dark in light mode (`WorkflowCanvas.tsx`, `useTheme`). The canvas is being rebuilt in `200-05`; a theme bug on a surface under re-presentation is cheapest to close while it is open.
- **`BUG-260807-01`** — NaN transform from a prototype key; **`BUG-260808-01`** — node-position lookup on a prototype slug. Both tagged `security/WR-04`. Correctness defects under the rebuilt canvas. ⚠ **Neither is a checklist row** — they widen `200-05` beyond D-01 deliberately, which the planner must budget for rather than discover.
- **`BUG-260816-06`** — the silent approval. Closed by **D-10**.

### Claude's Discretion

- Plan boundaries and wave sequencing within the six-plan shape, subject to CLAUDE.md's **dispatch at most TWO plans concurrently** rule and `GSD_VITEST_MAX_WORKERS=2`.
- The migration number and file name under `supabase/migrations/`, following `<digits>_name.sql`.
- Whether the new timestamps reach the client on the SSE emit stream, on fetch reconcile, or both — subject to **D-v2.5-03** (Realtime is a best-effort hint, always reconcile via fetch) and to `196`'s measured failure where a live-SSE lock with no fetch reconcile hid a shipped control.
- The exact `{count, noun}` field naming on the wire.

### Deferred Ideas (OUT OF SCOPE)

**The nine screens not in Phase 200.** All are all-blue or all-green — **no backend dependency**, so they carry no wire risk and can ship as a follow-on. **Re-open trigger for every one: the follow-on phase to 200 being scoped.**

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
| **the connections sheet** | 3 blue · 1 green | ⚠ **not merely deferred — it is a MILESTONE.** `SEED-144`, `SEED-145`, `SEED-146` (**EVERY capability is a WRITE**). No MCP client exists in the backend today |

**D-17 — the document viewer on the workflow surface.** Phase 200 takes **nothing new** here — it verifies the shipped listing as a green row. The no-previewer fence on `WorkflowRunPage.test.tsx` **STANDS**. What genuinely remains open in `SEED-148` is the CANVAS half, the WORKFLOW-PANEL half, and `PendingAskCard`'s absent file affordance.

**Amber rows the slice cannot clear — REPORT under D-02, with triggers:** `Locked by Alex M.` (lock-holder attribution not on the wire) · `Will overwrite 1,200 records` (no row count computed anywhere) · the fan-out router (the spine is LINEAR by recorded decision) · the run surface's NOW capture (needs a live run to photograph honestly).

**Bug halves explicitly NOT taken:** `BUG-260610-01`'s duplicate-avatar half · `BUG-260815-06` · `library-card-state-word-renders-twice` · `BUG-260816-03`.

**Not designed for, and why:** scheduling/automations (`SEED-014`) · branching/looping (recorded linear commitment) · self-hosted inference (`SEED-173`) · `SEED-151` Projects-as-container · `SEED-167` incremental/stateful runs.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DES-02** | A person watching or reviewing a workflow run can tell **how long each step took and how much it handled** — the run is measurable, not merely watchable — and the four surfaces that carry that (the step panel, the authoring spine, the canvas and the run surface) read in the adopted design language. | §B4-B7 give the exact write sites, migration slot, wire models and per-executor count facts that make "how long" and "how much" server-truths. §B10 names the three transports the fields must reach. §C11-C16 give the render sites, the pins that constrain them, and the vocabulary homes. §A1 is the atom inventory `200-01` derives the acceptance bar from. §E names the five risks that would make DES-02 ship and still fail the operator, as 199 did. |
</phase_requirements>

---

## A. The sketch ledger — the acceptance bar's raw material (feeds `200-01`)

### A1. The `JOURNEY` array, four in-scope screens, VERBATIM

Source: `.planning/sketches/200-journey-interactive/index.html`, `var JOURNEY = [` begins at **line 117** (measured; CONTEXT's "~117-228" is accurate). Each row's `what` and `note` below are transcribed character-for-character from that array, with the HTML entities (`&nbsp;` etc.) left as they appear.

#### `step-panel` — "The step panel · Refine one step"
`now:` `../200-journey-now/now-04-phase-form-panel.png` · `proposed:` `screens/step-panel.html` · `next:` `[["Close","builder-spine"],["◆ Publish…","publish"]]`

| # | `what` | `needs` | `note` | D-02 verdict |
|---|---|---|---|---|
| SP-1 | `24 raw snake_case tool ids against 3 human-named ones` | `frontend` | `MEASURED live. The inconsistency reads worse than the noise — 3 of 27 named makes it look half-finished.` | **BUILD** |
| SP-2 | `Sheet c4's MODEL / GROUNDING / EXTERNAL ACTION card sections` | `frontend` | `modelFitness.ts, the governance dial and the readiness contract ALL already exist. They were never composed into the sheet's shape.` | **BUILD** |
| SP-3 | `` `Failed to read registry` error state `` | `none` | `199-06 BUILT this — the picker says it now instead of vanishing.` | **VERIFY** |
| SP-4 | `` `Locked by Alex M.` — a lock attributed to a person `` | `data` | `Who holds a lock is not on the wire.` | **REPORT** (outside slice) |
| SP-5 | `` `Will overwrite 1,200 records` armed-action consequence `` | `data` | `No row count is computed anywhere.` | **REPORT** (outside slice) |

#### `builder-spine` — "The authoring spine · The order it will run in"
`now:` `../200-journey-now/now-03-builder-spine.png` · `proposed:` `screens/builder-spine.html` · `next:` `[["Select a step","step-panel"],["Canvas","builder-canvas"],["◆ Publish…","publish"],["← Workflows","library"]]`

| # | `what` | `needs` | `note` | D-02 verdict |
|---|---|---|---|---|
| BS-1 | `` <code>READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · on-fail branch (skip_to_phase) · no depends_on · no parallel lanes</code> `` | `frontend` | `11px mono, visible at rest. The noisiest string in the product. Kept by DEC-199-02-F as a locked 019-D contract.` | **BUILD** (a `MUST NOT RENDER` atom) |
| BS-2 | `` Per-step <code>llm_agent</code> chip and <code>phase_index N</code> line `` | `frontend` | `Kept by D-187-16 as the spine's 'measured basis'. The SAME step reads 'AI agent step' on the canvas — two views, two languages.` | **BUILD** (`MUST NOT RENDER`) |
| BS-3 | `Per-step model name, type badge, branch TRAVERSED/SKIPPED` | `frontend` | `All four are already in the definition the client holds.` | **BUILD** |
| BS-4 | `Per-step timings and total runtime (sheet c3 col 3)` | `data` | `MEASURED: WorkflowRunPhase carries exactly slug, phase_index, status, phase_type. No timestamps at all.` | **BUILD** (amber INSIDE slice) ⚠ see §E-R2 |

#### `builder-canvas` — "The canvas · The same workflow, spatially"
`now:` `../200-journey-now/now-05-builder-canvas.png` · `proposed:` `screens/builder-canvas.html` · `next:` `[["Select a node","step-panel"],["Spine","builder-spine"]]`

| # | `what` | `needs` | `note` | D-02 verdict |
|---|---|---|---|---|
| BC-1 | `Connections carry no payload label` | `data` | `199-05's flagship CANNOT-EXPRESS. Sheet c1 draws '312 contracts → 48 extracted → 12 flagged'.` | **BUILD** (amber INSIDE slice) ⚠ see §E-R2 |
| BC-2 | `Four of c1's five connection states are unexpressed` | `frontend` | `199-05, measured. Only the shipped one exists.` | **BUILD** |
| BC-3 | `A branch node does not show its own condition` | `frontend` | `on_failure: skip_to_phase:&lt;slug&gt; IS in the definition. This half is frontend-only and was never built.` | **BUILD** |
| BC-4 | `Node glyphs are large filled circles, not the line vocabulary` | `frontend` | `Sheet c1 uses small inline line marks. icon-convention §4 has no row for three shipped marks (199-05).` | **BUILD** |

#### `run-surface` — "The run surface · Watch it work"
`now:` **`null`** · `proposed:` `screens/run-surface.html` · `next:` `[["← Workflows","library"]]`

| # | `what` | `needs` | `note` | D-02 verdict |
|---|---|---|---|---|
| RS-1 | `NOT YET CAPTURED — needs a live run` | `capture` | `An honest hole in this prototype. Left empty rather than drawn from imagination.` | **REPORT** (no comparison half) |
| RS-2 | `Per-step counts in the live column (sheet c3 col 2)` | `data` | `'312 docs matched', '48 fields extracted' — nothing emits these.` | **BUILD** (amber INSIDE slice) |
| RS-3 | `The execution trace and total runtime (col 3)` | `data` | `Same missing timestamps as the spine.` | **BUILD** — ⚠ **PARTIALLY**, see §E-R3 |

**Arithmetic check against CONTEXT's scope table** (`build / slice / verify`): step-panel 2/2/1 ✓ · builder-spine 3/1/0 ✓ · builder-canvas 3/1/0 ✓ · run-surface 0/2/0 ✓ (the `capture` row is not counted). **The table is correct.** Note the two step-panel amber rows are `REPORT`, not `BUILD` — the column header "slice" is ambiguous and the planner should not read it as "two things to build".

**The `NEEDS` colour map, verbatim** (`index.html`, immediately after `JOURNEY`):
```js
var NEEDS = {
  none:     {label:"already shipped", color:"#21C45D"},
  frontend: {label:"frontend only",   color:"#A3A5FF"},
  data:     {label:"NEEDS BACKEND",   color:"#F5A524"},
  capture:  {label:"not captured",    color:"#6B7383"}
};
```

### A2. Known nits / recorded defects — D-04's §0 source, exhaustive

From `README.md` § *"Known nits, carried rather than re-run"* (three), plus five more this research measured that the README does not list:

| # | Defect | Where recorded | Correction the checklist must write in |
|---|---|---|---|
| N-1 | Spine fork lanes name `Confirm the QBR before rendering` / `Fill the QBR template` — the **pre-rename** step names | README, nit 1. Confirmed present in `screens/builder-spine.html` text extract | Use the current step names |
| N-2 | Draft-arrival card footer reads `How long it looks back` ×2 | README, nit 2 | `Open in the builder` / `See the steps` — **but the draft-arrival screen is OUT OF SCOPE**, so this nit is inert for Phase 200. List it, mark it not-applicable. |
| N-3 | Run surface has **no NOW capture** | README, nit 3; `JOURNEY.run-surface.now === null` | No shipped half to compare against; the screen's acceptance is the proposal alone |
| N-4 | Connections sheet: nine gstatic `stitch-placeholder-300x300.svg` marks | `JOURNEY.connections` gap row 1, "MEASURED: svg count 0" | `@lobehub/icons` via `providerLogo.tsx`. **OUT OF SCOPE** (connections is a milestone) — list, mark not-applicable |
| **N-5** ⚠ NEW | **Every in-scope screen draws Material Symbols ligature names as its icon vocabulary** — measured in the rendered text of all four: `description`, `bolt`, `search`, `check_circle`, `chevron_right`, `folder`, `lock`, `shield`, `add`, `close`, `info`, `error`, `priority_high`, `sync`, `psychology`, `account_tree`, `summarize`, `save_as`, `fit_screen`, `widgets` | Measured this session by stripping tags from `screens/*.html` | The product's icon authority is `icon-convention.md` §1 (`@lobehub/icons` for provider/model marks), §2 (`PHASE_GLYPHS` for phase types) and §4 (the canvas mark table). **No Material Symbols ligature is a shippable atom.** A checklist row naming one would be a defect promoted to a criterion. |
| **N-6** ⚠ NEW | The step-panel screen names three **stale model literals** — `GPT-4o`, `Claude 3.5 Sonnet`, `Llama 3 Instruct` | Same extract | Models come from the registry (`useModelRegistry` / `ModelField`), never a literal. These are placeholder text, not atoms. |
| **N-7** ⚠ NEW | The step-panel screen renders the lock as `Locked — only the person who locked it can release it` — **with no person named**. The ledger's amber row SP-4 is `Locked by Alex M.` | Same extract | The two disagree. **The rendered screen's version needs no wire data and already ships** (199-06's one-way grounding dial). The planner must derive from the SCREEN and report SP-4 as an atom the screen itself does not draw. |
| **N-8** ⚠ NEW | The run-surface screen's spine row reads `Summarized meeting notes` — a *sentence*, sitting in the same slot as the count `Found 12 contracts` | Same extract | Under D-07 a step with no real number renders **nothing** in that slot. Drawing prose there would re-introduce exactly the fabricated-figure failure D-07 exists to prevent. |

### A3. Screen captures and pairing

`.planning/sketches/200-journey-now/` (the shipped-product captures):

| File | Pairs with sketch id | In Phase 200 scope? |
|---|---|---|
| `now-01-library.png` | `library` | no |
| `now-02-run-dialog.png` | `run-dialog` | no |
| `now-03-builder-spine.png` | **`builder-spine`** | **yes** |
| `now-04-phase-form-panel.png` | **`step-panel`** | **yes** |
| `now-05-builder-canvas.png` | **`builder-canvas`** | **yes** |
| `now-06-publish-gauntlet.png` | `publish` | no |
| `now-07-chat-panel.png` | *(no `JOURNEY` row references it)* | no — orphan |

⚠ **README staleness:** the README says *"the six real captures of the shipped product"* and the Files table says `../200-journey-now/` holds "the six real captures". **There are SEVEN files.** `now-07-chat-panel.png` is referenced by no `JOURNEY` row's `now:` field (grep of the array returns `now-01`…`now-06` only). Minor; record it so `200-01` does not go looking for a seventh pairing.

**`.planning/sketches/200-journey-interactive/screens/` — 13 files, exactly matching the 13 `JOURNEY` entries.** The four in scope: `step-panel.html` (28,455 B) · `builder-spine.html` (32,310 B) · `builder-canvas.html` (27,077 B) · `run-surface.html` (17,673 B).

**`thumbs/` holds 7 PNGs** (`builder-spine`, `doors`, `draft-arrival`, `library`, `library-r1`, `spine-external`, `step-panel`) — a partial working set, not a 1:1 pairing. `tools/` holds `fetch-screen.cjs` and `sync.cjs`.

✅ **CONTEXT's claim that the run surface has no NOW capture is CONFIRMED** — `JOURNEY.run-surface.now` is literally `null`, and no `now-*run*` file exists.

### A4. What the four proposed screens actually draw (text extracted this session)

Useful to `200-01` because the HTML is 105 KB across four files and the ledger `gap` rows do not enumerate atoms.

- **`run-surface`** draws **two columns**: a left **execution trace** (`00:00 Started run` · `00:02 Connecting to Northwind CRM instance…` · `00:05 Extracted vendor list` · `00:08 Pulling commercial agreements and SLAs…` · `00:15 Analyzing risk factors` · `00:22 Synthesizing recent meeting notes…` · `00:35 Flagged inconsistency in SLA reporting for Q2. Awaiting review.` · `00:42 Drafting executive summary…`) and a right **Workflow Progress** spine (`Pull usage and support history` / `Found 12 contracts` · `Pull commercial position and meeting notes` / `Summarized meeting notes` · `Draft the QBR narrative sections` / `Needs your review before it continues.` + `Approve` / `Send back` · `Confirm the QBR before rendering` `00:15` · `Fill the QBR template`). Header carries `00:42` and `Stop this run`.
- **`builder-spine`** draws the fork lanes with `THIS WAY` / `NOT THIS WAY`, per-step type sentences (`Searches the knowledge base and decides its own next move` / `AI AGENT`, `Writes one piece in a single pass` / `ONE-SHOT WRITER`, `Pauses and waits for a person` / `WAITS FOR A PERSON`, `Produces the finished file` / `PRODUCES THE FILE`, `CHANGES SOMETHING OUTSIDE`, `ONLY READS`), the `How a workflow can end` explainer, and `View only — this is the order it will run in.` **It draws NO per-step duration and NO total runtime** — BS-4 is an atom the proposed screen does not itself show.
- **`builder-canvas`** draws node sentences, a branch (`Over £2m?` → `Escalate to the risk committee` / `High risk path`, `File as routine` / `Standard path`), the four connection states as a legend (`at rest` · `selected` · `hovered` · `not taken`), zoom controls (`100%`, `fit_screen`, `lock`). **It draws NO payload label** — BC-1 is likewise an atom the proposed screen does not itself show.
- **`step-panel`** draws `Explain each field`, `What it does`, `Model` + `Strong for judging` + `We couldn't load the list of models.`, `What it can reach` (folders + `Lock` + `Locked — only the person who locked it can release it`), `What this step can do` (12 human-named tool phrases + `Pick from the tools this workspace allows — you cannot add one by typing.`), `What it changes outside this workflow` (`Writes to your database` `NEEDS ARMING`, `Sends a Slack message`), `Files it starts from` (`Nothing attached yet`, `We could not read this file`), `How strictly it is held` (`Loose`/`Strict` + `Every claim must be cited from your documents.`), `2 things still missing`.

⚠ **The most important consequence for `200-01`:** for `builder-spine` and `builder-canvas`, the **amber rows describe capability the sketch's own screens do not draw**. The checklist cannot derive those two `MUST RENDER` atoms from the HTML — it must derive them from the **ledger `note` + sheet c3 col 3 / c1** and say so explicitly, or the checklist will silently drop the exact two rows that justify lifting the presentation-only fence.

---

## B. The wire slice (feeds `200-02`)

### B4. D-05's write sites — VERIFIED, and **the count is SEVEN, not six**

Re-derived at HEAD with `grep -n "UPDATE workflow_phases SET status" backend/app/db/workflows.py`:

| # | Function (def line) | UPDATE line | SQL, verbatim | Keyed by |
|---|---|---|---|---|
| 1 | `mark_phase_active` (`:1435`) | **1441** | `UPDATE workflow_phases SET status='active', updated_at=now() WHERE id = $1` | phase id |
| 2 | `complete_phase` (`:1446`) | **1483** | `UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'` | phase id |
| 3 | `fail_phase` (`:1488`) | **1505** | `UPDATE workflow_phases SET status='failed', output=$2::jsonb, updated_at=now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'` | phase id |
| 4 | `skip_phase` (`:1510`) | **1517** | `UPDATE workflow_phases SET status='skipped', updated_at=now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'` | phase id |
| 5 | `record_phase_not_sent` (`:1522`) | **1548** | `UPDATE workflow_phases SET status='recorded_not_sent', output=$2::jsonb, updated_at=now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'` | phase id |
| 6 | `cancel_phase` (`:1553`) | **1597** | `UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE id = $1` | phase id |
| **7** ⚠ | **`cancel_active_phases` (`:1602`)** | **1649** | `UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE workflow_run_id = $1 AND status = 'active'` | **RUN id** |

**Every line number in D-05 is exactly right, and the enumeration is one short.** `cancel_active_phases` is the **engineless zombie / no-producer arm** — the path with no engine loop and no `phase_id`, used when a Stop lands with no producer running (`db/workflows.py:1602-1652`, its docblock names the two-writer split in full). Its `WHERE … status = 'active'` clause means it only ever moves rows that HAVE a `started_at`, so `completed_at = now()` is correct there. **A plan that writes six sites and calls the slice complete will leave a hole exactly on the Stop-with-no-producer path** — the path 194 built specifically because it was reachable.

**One eighth site, for completeness:** the batch INSERT at `db/workflows.py:334`:
```sql
INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status)
VALUES ($1, $2, $3, 'pending')
```
It writes no timestamp and must not learn to — `started_at` is precisely the thing `created_at` cannot be (D-05's whole argument).

**A transition path the seven do NOT cover — named, not hidden:** the crash / non-`CancelledError` escape. `harness_engine.py:1707` guards the interrupted-phase terminalize with `if isinstance(_escape, asyncio.CancelledError)`, and the docblock at `:1698-1706` records the residual verbatim: *"an `active` phase row under a run that ends `failed`. That is PRE-EXISTING and inherited."* Such a row will carry a `started_at` and a NULL `completed_at` forever. **D-06's render table has no arm for it.** A `status='active'` row on a TERMINAL run is neither "ticks live" nor "never ran" nor "time not recorded" — a live-ticking clock on a run that ended is the `BUG-260610-01` symptom re-created. **Recommend a fifth D-06 arm: `active` + terminal run ⇒ "did not finish".**

### B5. Migrations — the next free number, the table, the constraint, the RLS chain, the trigger

**Highest migration on disk: `120_model_capabilities_overrides_emit_tier.sql`. Next free number: `121`.** (`ls supabase/migrations/ | sort -V | tail -1`.) Letter suffixes are silently skipped by the CLI (CLAUDE.md), so `121_workflow_phases_timings.sql` or similar.

**`058_workflow_phases.sql` — the exact column set:**
```sql
CREATE TABLE public.workflow_phases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    phase_index     integer NOT NULL,
    slug            text NOT NULL,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','completed','failed','skipped')),
    output          jsonb NOT NULL DEFAULT '{}',
    org_id          uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_phases_run ON public.workflow_phases(workflow_run_id, phase_index);
```
⚠ **`slug` is a bare `text NOT NULL` with no pattern and no reserved-word list** — the boundary half of `BUG-260807-01` / `BUG-260808-01` / `SEED-143`. Corroborated by `backend/app/models/harness.py:202`, `slug: str`, unconstrained.

**The status CHECK-constraint array — THE AUTHORITY (`119_workflow_phases_cancelled.sql`, tail):**
```sql
ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (
    status = ANY (ARRAY[
        'pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text,
        'recorded_not_sent'::text,
        'cancelled'::text
    ])
);
```
**Seven literals.** Phase 200 adds **no** new phase status — D-10 pauses the RUN, not the phase.

**RLS — the 2-hop FK chain, four policies, all identical predicate:**
```sql
auth.uid() = (SELECT t.user_id FROM threads t
              JOIN workflow_runs wr ON wr.thread_id = t.id
              WHERE wr.id = workflow_run_id)
```
on `SELECT`, `INSERT`, `UPDATE`, `DELETE` (`058:38-77`). **None names a column list**, so `ALTER TABLE … ADD COLUMN` touches no policy. ✅ No RLS work owed by the timestamps. (The engine writes through a service-role pool that BYPASSES RLS; the API read at `api/workflow_runs.py` goes through the **user-JWT** client, so RLS is the belt to the ownership check's braces.)

**The `updated_at` trigger — the exact definition:**
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER workflow_phases_set_updated_at
  BEFORE UPDATE ON public.workflow_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```
(`014_folders.sql:52-58` for the function; `058_workflow_phases.sql` tail for the trigger. Confirmed identical in `supabase/full-schema.sql:434-441`.)

**Does it interfere with new timestamp columns?** **No, in both directions:**
- It writes **only** `NEW.updated_at`. It cannot clobber `started_at`/`completed_at`.
- It fires on **every** `UPDATE` regardless of which columns changed, so a statement that sets only `started_at` still bumps `updated_at`. That is harmless — and it means the seven write sites can **keep their explicit `updated_at=now()`** unchanged (the trigger would set it anyway; removing it is a diff nobody needs).
- ⚠ **It is `BEFORE UPDATE`, not `BEFORE INSERT`** — so the batch INSERT's `updated_at` comes from the column DEFAULT. Unchanged.

**Recommended migration shape** (following house style from 115/119): `BEGIN; ALTER TABLE public.workflow_phases ADD COLUMN IF NOT EXISTS started_at timestamptz, ADD COLUMN IF NOT EXISTS completed_at timestamptz; COMMENT ON COLUMN …; COMMIT;` — both **nullable, no default, no backfill** (D-06). `IF NOT EXISTS` makes a re-paste safe, matching 119's rule 2.

### B6. `api/workflow_runs.py` — every field, the `response_model`, and the test entry point

**`WorkflowRunPhaseRead` (`:76-103`) — the complete field list:**

| Field | Type | Default | Note |
|---|---|---|---|
| `slug` | `str` | required | |
| `phase_index` | `int` | required | |
| `status` | `str` | required | `Field(description=…)`; the description's prose is explicitly disclaimed in favour of migration 119's ARRAY |
| `phase_type` | `str \| None` | `None` | **derived** from the definition JSON by `_slug_to_phase_type` (`:152`); the table stores no such column |

**`WorkflowRunRead` (`:106-127`):** `id`, `thread_id`, `definition_id`, `workflow_name`, `workflow_slug`, `workflow_version`, `status`, `created_at`, `claimed_at`, `updated_at`, `definition`, `phases`.

✅ **The route DOES declare `response_model=WorkflowRunRead` — `api/workflow_runs.py:173`.** So 192.2's silent-drop lesson applies in full: any key the serializer produces but the model does not declare is dropped without error.

⚠ **AND THERE IS A SECOND NARROWING THE CONTEXT DOES NOT NAME.** Line **230**:
```python
phases_resp = await aexec(
    supabase.table("workflow_phases")
    .select("slug, phase_index, status")           # ← the PostgREST projection
    .eq("workflow_run_id", str(run["id"]))
    .order("phase_index")
)
```
**Three places must be widened in lockstep**: the `.select()` string (`:230`), the Pydantic model (`:85-103`), and the serializer (`:237-245`). Widening only two of three produces a green model and an empty field. `output` is **not** currently selected — if the counts ride in the `output` jsonb (D-07's stated carrier), the select must gain `output` too, or the API must gain a computed column.

**The test entry point that drives this route through a real `TestClient`: `backend/tests/test_188_workflow_run_read.py`.** It uses `TestClient` (`:267`, `:288-289`, `:318`, `:338`, `:394`, `:440`, `:450`, `:455`) with `app.dependency_overrides[get_user_supabase_client]` and a `_FakeSupabase` row store.

⚠ ⚠ **AND IT IS STRUCTURALLY BLIND TO THE FAILURE THIS PHASE IS MOST LIKELY TO SHIP.** `_FakeQuery.select` (`:121-122`) is:
```python
def select(self, *_columns, **_kwargs):
    return self
```
**A no-op that discards its column list and returns whole seeded rows.** So a test that seeds `started_at` on the phase rows will read it back **even if `:230` was never widened** — the exact opposite of PostgREST's behaviour. The suite that looks like it protects the wire cannot see the projection at all. **Mitigation the planner must encode:** make `_FakeQuery.execute` project to the requested columns (a ~4-line change with a positive control asserting an unselected key is ABSENT), **or** add a source fence over `api/workflow_runs.py` asserting the `.select(` string names each new column, **or** both. A plain `.select("*")` would also work but weakens the read.

### B7. The phase types and their real count facts — D-07's whole bounded surface

⚠ **CORRECTION: THERE ARE SEVEN PHASE TYPES, NOT EIGHT.** `PHASE_TYPE_REGISTRY_ENTRIES` (`phase_types.py:2398-2410`) has exactly seven keys, and the comment above it says "The 7 executors". **`llm_judge_rubric` is a VALIDATOR kind**, registered by `@register_validator("llm_judge_rubric")` at `backend/app/services/harness/validator_kinds.py:500`, and declared in `ValidatorSpec.kind`'s `Literal[...]` at `backend/app/models/harness.py:350` — **not** in `PhaseConfig`'s `phase_type` discriminated union (`harness.py:68, 77, 93, 110, 129, 154, 242` — seven members). See §C16.

| # | `phase_type` | Executor (line) | Return dict keys | **Real count fact?** | Honest `noun` |
|---|---|---|---|---|---|
| 1 | `programmatic` | `_exec_programmatic` (`:507`) | delegated — `return await fn(fn_input, ctx)` | ⚠ **registry-dependent.** The closed registry (`harness/programmatic.py:36-43`) exposes `split_topic` + `eval_slow_step`; `split_topic` returns `{"sub_questions": [...]}` (`:97`, `:118`) — `len(sub_questions)` IS a fact | `sub-questions` — but see the warning below |
| 2 | `llm_single` | `_exec_llm_single` (`:540`) | `{"text"}` | **NO** | — (renders nothing) |
| 3 | `llm_agent` | `_exec_llm_agent` (`:566`) | `{"text","sub_run_id","source_refs","citations","similarity_scores"}` | **YES** — `len(source_refs)` is the grounding the sub-agent actually retrieved | `sources` |
| 4 | `llm_batch_agents` | `_exec_llm_batch_agents` (`:655`) | `{"text","sub_run_ids","source_refs","citations","similarity_scores"}` | **YES** — `len(sub_run_ids)` is exactly the number of parallel agents that ran (`results = await asyncio.gather(...)`, `:727`) | `agents` |
| 5 | `llm_human_input` | `_exec_llm_human_input` (`:760`) | `{"text","answer","tool_call_id"}` | **NO** | — |
| 6 | `llm_emit` | `_exec_llm_emit` (`:1225`) | success arm returns `{"text","output_file","path","field_map","retrieved_ids","placeholder_keys","source_refs","citations"}` (`:1616-1631`) | **YES** — `len(field_map)` is the number of fields the forced emission actually filled and the citation gate passed. `len(placeholder_keys)` is a second candidate (template slots) | `fields` |
| 7 | `external_action` | `_exec_external_action` (`:2079`) | success: `{"text"}` (`:2390`); failure arms add `{"failure"}` | **NO** — one send is not a count | — |

**So the honest surface is FOUR types with a number and THREE without** (`programmatic` conditionally, and only via its registered fn). Recommendation:

- **Emit from types 3, 4, 6 unconditionally** — the fact is in the return dict already.
- **`programmatic` should NOT declare a count in this phase.** The registry is a closed dict but its members are pluggable and their shapes differ per `fn`; a `len(whatever_list_happens_to_be_there)` is precisely the structural derivation D-07 rejected. If it is wanted, it must be a per-`fn` declaration, which is a fifth site and a second concern.
- **Types 2, 5, 7 must emit NOTHING.** Not `0`, not `null`-with-a-noun, not a dash. The absence must be an absent KEY, so the client's arm is `hasOwnProperty`-shaped and not `?? 0`-shaped (the `runFacts.ts` / `modelFitness.ts` house rule).
- ⚠ **`source_refs` on types 3 and 4 can legitimately be `[]`** (a step that searched and found nothing). `[]` → `count: 0` is a REAL fact and is **not** the same as "no count" — SEED-159's whole point. The client needs `0 sources` to be renderable and distinguishable from absence. This is the count-side twin of D-06 and CONTEXT does not state it.

**Where the count rides:** `harness_engine.py:142` `_persist_output` writes the executor dict **full and inline** into `workflow_phases.output` jsonb, so `{"_count": N, "_noun": "sources"}` (or a nested `{"_measure": {...}}`) needs **no column and no migration**. It does need §B6's `.select()` widened to include `output`, or a narrower computed projection.

### B8. The human-input executor, the timeout path, and how a run reaches `paused`

**The `answer = ""` initialisation and the `response` branch — verbatim, `phase_types.py:872-888`:**
```python
    answer = ""
    if payload and payload.get("kind") == "response":
        # BUG-260607-01 (same defense as the Deep dispatcher ask_user handler):
        # a choice-click answer arrives as {response_text: "", choice_index: N}
        # — resolve the chosen option text so the workflow never advances on a
        # silently-empty answer when the user actually chose.
        answer = (payload.get("response_text") or "").strip()
        if not answer and options:
            _ci = payload.get("choice_index")
            try:
                _ci = int(_ci)
                if 0 <= _ci < len(options):
                    answer = str(options[_ci])
            except (TypeError, ValueError):
                pass

    return {"text": prompt, "answer": answer, "tool_call_id": tool_call_id}
```
(CONTEXT cites `:818-856`; at HEAD the block is **`:872-888`** — a ~54-line drift. `subscribe_for_response` is at `:851`, the shutdown branch at `:866`.)

**What happens on timeout today, traced exactly:**
1. `subscribe_for_response(redis, run_id, tool_call_id, float(timeout_seconds))` returns **`None`** (`:851`).
2. The shutdown branch (`:866`) does not fire (`payload` is falsy).
3. `answer` stays `""`; the `response` branch does not fire.
4. The executor **returns normally** with `answer: ""`.
5. `_run_phase_with_gates` wraps it in `PhaseOutcome("completed", output, None, None)` (`harness_engine.py:931` / `:1431`).
6. `run_workflow` calls `complete_phase` → the row reads `completed`, the run proceeds, the next phase receives `""` as the human's answer. **Exactly `BUG-260816-06`.**

**The precedent that already does the right thing, in the same function:** the shutdown branch at `:866-870` raises `asyncio.CancelledError` **specifically so the phase stays `active` and the durable prompt row stays pending**, and the engine's escape handler skips prompt-expiry when `is_app_shutting_down()`.

**⚠ WHO WRITES `workflow_runs.status = 'paused'`? NOBODY.**

`grep -rn "'paused'" backend/app --include=*.py` returns **seven hits, all READS**:

| File:line | What |
|---|---|
| `api/workflows.py:1682` | `AND wr.status IN ('active','paused','cap_paused')` — delete-cascade in-flight sweep |
| `db/workflows.py:1180` | `AND status IN ('active','paused','cap_paused')` — the lock banner |
| `db/workflows.py:1296` | `WHERE wr.status IN ('active','paused')` — **`find_resumable_runs`** |
| `db/workflows.py:1799, 1818` | `AND status IN ('active','paused')` — the claim/lease writes |
| `db/workflows.py:1788, 1808` | docstring prose |

And the only `UPDATE workflow_runs SET status` writer is `finish_run` (`db/workflows.py:1754`). Its guard (`:1752-1760`) is:
```sql
UPDATE workflow_runs SET status = $2
WHERE id = $1
  AND (status IS NULL OR status NOT IN ('completed','failed','cancelled') OR status = $2)
```
— it would *accept* a `paused` write, **but it also clears the thread anchor in the same transaction** (`threads.active_workflow_run_id`, Phase 092 SC#2). **Clearing the anchor makes the run permanently unresumable**, because `find_resumable_runs` requires `t.active_workflow_run_id = wr.id`. So `finish_run` is the wrong writer for a pause and must not be reused.

**⚠ AND THERE IS NO RESUME PATH FOR A PAUSED RUN OTHER THAN A PROCESS RESTART.**

- `find_resumable_runs` (`db/workflows.py:1250`) is called from exactly one place: `harness_engine.resume_stranded_workflows`, invoked from `backend/app/main.py:406-408` inside the lifespan `_resume_stranded()` task. **It is a boot-time sweep.**
- The answer endpoint is `POST /runs/{run_id}/ask_user_response` (`api/runs.py:503`). Step 4 calls `ask_user_service.publish_response` (`api/runs.py:645-646`) → a Redis **PUBLISH** to `ask_user:{workflow_run_id}:{tcid}`. **If the executor's `subscribe_for_response` has already timed out and returned, nothing is subscribed and the publish reaches no listener.**

**⇒ D-10's sentence "Answering later still resumes; nothing is discarded" is NOT true of the current architecture and requires new machinery.** Three viable shapes, in increasing cost:

| Option | What it needs | Cost | Honesty |
|---|---|---|---|
| **(a) Pause + boot-sweep only** | new `pause_run` db writer (no anchor clear) + a new `PhaseOutcome("pause_run", …)` kind + an engine arm that leaves the phase `active`, does NOT expire the prompt, and returns | smallest | ⚠ **dishonest** unless the UI says "this run resumes when the server restarts". Do not ship this wording. |
| **(b) Pause + answer-triggered re-drive** | (a) **plus** `submit_ask_user_response` detecting a `paused` workflow run and spawning `_build_resume_context` → `run_workflow` (the same call the boot sweep makes) | medium | ✅ matches D-10's promise exactly |
| **(c) Don't time out at all** | remove the per-phase timeout for `llm_human_input`; keep the run `active` and mark it `paused` for display only | smallest code, largest semantic change | ⚠ contradicts `settings.ask_user_max_timeout_seconds` (the 1800 s hard cap) and leaks a blocked coroutine per waiting run |

**Recommendation: (b).** It reuses `_build_resume_context` (`harness_engine.py:2066`), which is the canonical shape three other callers already mirror, and it is the only option that makes the D-10 wording true. It is also why `200-02` should be two waves — this is not an additive change.

**⚠ THREE THINGS THE PAUSE ARM MUST NOT DO, each measured:**
1. **It must not `raise asyncio.CancelledError`.** The engine's escape handler (`harness_engine.py:1632-1716`) then (i) calls `_expire_pending_ask_user` — killing the very prompt the person is meant to answer — and (ii) calls `cancel_phase(pool, phase_id)` at `:1709`, flipping the phase to `cancelled`. Both are exactly wrong for a pause.
2. **It must not call `finish_run`.** Anchor clear ⇒ unresumable (above).
3. **It must not leave the phase `completed`.** `find_resumable_runs` requires an `active` phase row.

**Also worth planning around:** if the run flips to `paused` with the phase left `active` and the anchor intact, the **next server restart WILL re-drive it** via the boot sweep (`resume_pending_prompt` re-emits the SAME prompt — `ask_user_service.py:239`). That is desirable, and it is the existing 096-09 contract. Verify it still holds after the change.

### B9. D-13's extraction — size, imports, importers, and the precedent's shape

**Size.** `_exec_llm_human_input` spans **`phase_types.py:760-888` = 129 lines**, of which ~55 are docblock/comment. The file is **2424 lines** total, so the extraction is ~5%.

**What it imports** (module-level names the moved function uses): `uuid4`, `logger`, `settings`, `subscribe_for_response` (from `app.services.ask_user_service`), `_latest_phase_text` (module-private helper at `:1715`), `asyncio`, `UUID`, and `aexec` (imported *inside* the function at `:792`).
⚠ **`_latest_phase_text` is a module-private sibling** — the extraction must either move it too (it is used only here: `grep -c "_latest_phase_text" phase_types.py` → 2, the def and this one call) or import it back. Moving it is cleaner and makes the new module self-contained.

**What imports the executor:** only `PHASE_TYPE_REGISTRY_ENTRIES` (`phase_types.py:2404`). Nothing outside the file names `_exec_llm_human_input` (`grep -rn "_exec_llm_human_input" backend/` → the def, the registry entry, and this file only). ✅ **A clean single-reference cut.**

**Sibling-module pattern in `backend/app/services/harness/`:** the package already splits by concern — `programmatic.py` (the closed fn registry), `emitters.py`, `validator_kinds.py`, `grounding.py`, `publish_service.py`, `phase_types.py`. A new `harness/human_input.py` is exactly in keeping. `harness/__init__.py:20` imports `phase_types` last so `register_all()` runs; the new module must be imported by `phase_types.py` (or by `__init__`) before `register_all()` binds the dict.

**The named precedent — `backend/app/api/threads.py` → `backend/app/services/run_transport.py`, VERIFIED:**
- `run_transport.py` exists, **116 lines**, `git log --oneline` → **1 commit**, phases → **0** (the commit subject carries no `NNN` bucket).
- ⚠ **"The re-import in `threads.py` is load-bearing" — CONFIRMED.** `docs/HOT-FILE-LEDGER.md`'s `threads.py` section records it, and the shape is: the leaf is cut out, and `threads.py` imports the symbol back so **every existing call site inside `threads.py` stays byte-identical**. The extraction is a MOVE plus an IMPORT, never a MOVE plus N EDITS. That is what keeps the diff reviewable and the behaviour provably unchanged.
- **Apply the same shape here:** `phase_types.py` gains `from app.services.harness.human_input import _exec_llm_human_input` (or a public name) and the registry entry at `:2404` stays character-identical. Then the D-10 fix lands **inside the new module**, so `git diff` over `phase_types.py` shows an import and a deletion — nothing else.

### B10. How phase-level updates reach the client today — **THREE transports, and all three need widening**

| # | Transport | Site | Payload today | Needs the new fields? |
|---|---|---|---|---|
| 1 | **SSE emit** `phase_started` | `harness_engine.py:1589-1594` — `_emit(redis, stream_run_id, "phase_started", phase=…, phase_index=…, phase_type=…)` | slug, index, type | **YES** — `started_at`, so the live tick has an anchor without a fetch |
| 2 | **SSE emit** `phase_completed` | `harness_engine.py:1962-1966` — `_emit(…, "phase_completed", phase=…, phase_index=…)` | slug, index | **YES** — `completed_at` + the declared `{count, noun}`. (Siblings `phase_recorded_not_sent` at `:1950`, `phase_transition` at `:1975`.) |
| 3 | **Fetch reconcile A** `GET /threads/{id}/workflow` | `api/threads.py:1191-1194` raw SQL `SELECT slug, phase_index, status FROM workflow_phases …` → `WorkflowPhaseState` (`backend/app/models/thread.py:48-60`) | slug, index, status, derived type | **YES** — this is the CHAT-surface reconcile, and it is a **separate model and a separate SELECT** from #4 |
| 4 | **Fetch reconcile B** `GET /workflow-runs/{id}` | `api/workflow_runs.py:228-245` → `WorkflowRunPhaseRead` | same four | **YES** — §B6 |

⚠ **CONTEXT names only #4.** `WorkflowPhaseState` in `models/thread.py` is a **second, independent wire model for the same rows**, feeding the workspace panel's `PhaseTimeline`/`PhaseCard` — which are the `200-06` render targets. **A plan that widens only `WorkflowRunPhaseRead` will ship a run page with durations and a chat panel without them.**

**The answer to the Claude's-Discretion question: BOTH, with fetch authoritative.** Reasons, each measured: (i) CLAUDE.md's D-v2.5-03 rule; (ii) `196`'s live-SSE-lock failure; (iii) `PhaseTimeline`'s own reconcile floor exists precisely because a terminal run has no stream (`models/thread.py:49-54`); (iv) a live tick needs `started_at` at the moment the step starts, which only #1 delivers without polling.

---

## C. The four frontend surfaces (feeds `200-03`…`200-06`)

### C11. The render targets — line counts, what they draw, which sketch rows land

All line counts measured with `wc -l` this session.

| File | Lines | What it renders today | Sketch rows landing on it |
|---|---|---|---|
| `frontend/src/components/panel/PhaseTimeline.tsx` | **267** | The workspace panel's run timeline: `<ol>/<li>/<PhaseCard>` (`:258`), aria-busy, a doing-now line. Sole mount: `WorkspacePanel.tsx:542`. | RS-2, RS-3 (the panel half of the run surface) |
| `frontend/src/components/panel/PhaseCard.tsx` | **543** | One step's card in the panel: glyph + status word + tone, from `statusMeta()`. | RS-2, RS-3 |
| `frontend/src/components/panel/phaseStatusMeta.ts` | **206** | `STATUS_META` — the panel's 9-member status vocabulary (`pending/running/done/failed/retrying/skipped/recorded-not-sent/unknown/cancelled`), `statusMeta()` with a `hasOwnProperty` guard (`:177-180`), `statusWord()` (`:204`). | D-06's arms attach here or beside it |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | **278** | The **AUTHORING** spine. Props: `phases: PhaseSpecJSON[]`, `selectedSlug`, `onSelectNode`, `nameContext?` — **NO RUN DATA AT ALL** (`:75-85`). Exports `READ_ONLY_LEGEND` (`:71`) — the exact string BS-1 says must not render. Sole mount: `WorkflowBuilderPage.tsx:2136`. | BS-1, BS-2, BS-3, BS-4 ⚠ |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | **1390** | The canvas plane, both authoring (`WorkflowBuilderPage.tsx:2106`, `editable`) and run (`WorkflowRunPage.tsx:1091`, `editable={false}` + `runState`). Carries `runState?: (slug: string) => NodeRunState \| undefined` (`:567`) — **the existing seam D-08 rides**. `colorMode="dark"` hardcoded at **`:1317`**. | BC-1, BC-2, BC-3, BC-4 |
| `frontend/src/components/workflows/FlowEdge.tsx` | **378** | The edge renderer. Exports `DETOUR` geometry (`:147`), `ARC` (`:178`), `LINE` (`:185`), `DETOUR_ARMED_LABEL = "you say yes"` (`:196`), `DETOUR_OPEN_LABEL = "nobody is asked"` (`:204`). **Already renders labels on edges** — the payload label has a home. | BC-1 (primary), BC-2 |
| `frontend/src/pages/WorkflowRunPage.tsx` | **1197** | The run surface: run band + elapsed + canvas + deliverables (`FileRow` at `density="run"`, `:1143-1177`). Carries the D-188-18 elapsed contract and the **no-previewer fence**. | RS-2, RS-3 |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | **1290** | **THE `step-panel` SCREEN.** The builder's step form. Sole mount: `WorkflowBuilderPage.tsx:2656`. | SP-1, SP-2, SP-3(verify), SP-4/SP-5(report) |

⚠ **THE STRUCTURAL PROBLEM IN BS-4, stated plainly because the planner will hit it in `200-04`.** `PhaseSpineGraph` takes a **draft definition** and has **no run**. CONTEXT's own `<canonical_refs>` says so (*"any run-time word on it is a fabricated claim — 199-02 refused exactly that"*), while CONTEXT's `<specifics>` says the slice *"clears the spine's per-step timings."* **Both cannot be true of the same component in the same mode.** The reconciliation is D-09: *"the same spine re-read in the PAST TENSE — one component, two tenses."* So `200-04` must give `PhaseSpineGraph` an **OPTIONAL run-tense prop** (absent ⇒ byte-identical authoring render, which is also how `WorkflowCanvas.runState` and `PhaseFormPanel.rails` are both shaped — the house pattern). The authoring mount at `WorkflowBuilderPage.tsx:2136` passes nothing and stays unchanged; the receipt mount passes the run. **Say this in the plan or `200-04` will re-litigate 199-02's refusal.**

**Where the receipt should mount:** `WorkflowRunPage.tsx` (it already holds the run + definition in one fetch) — **not** `WorkflowBuilderPage.tsx`. That keeps 199-02's refusal intact by construction.

⚠ **`WorkflowCanvas.tsx` is mounted on BOTH pages.** Any `200-05` change is a change to the run surface too. The two mounts differ only by `editable` and `runState`; a regression here lands on `200-06`'s screen.

### C12. `PhaseFormPanel.test.tsx`'s ABSOLUTE-ZERO hook pin — VERBATIM

**The source import that makes it a source scan:** `frontend/src/components/workflows/PhaseFormPanel.test.tsx:23`
```ts
import phaseFormPanelSource from "./PhaseFormPanel?raw"
```

**The docblock (`:634-661`), clause 3 verbatim:**
> *3. `useMemo` / `useState` / `useEffect` are at an ABSOLUTE ZERO in this file's source. Not "no increase" — zero, because all three measured zero before this phase, and a non-decrease criterion on a file that already reads 0 is a criterion that permits the first one.*
>
> ⚠ THE MATCHED TOKENS ARE BUILT, NEVER SPELLED, in this file's prose and in the panel's. A comment that names the needle is COUNTED BY the fence that greps for it — the 187-24 trap, which this phase hit three separate times while writing these very paragraphs (twice in the panel's docblock, once in the comment explaining the first two).

**The assertion (`:711-716`) verbatim:**
```ts
  it("SOURCE — the panel computes NOTHING for the picker: an ABSOLUTE zero, not a non-increase", () => {
    // Built, never spelled — this assertion would otherwise count itself.
    for (const token of ["use" + "Memo(", "use" + "State(", "use" + "Effect("]) {
      expect(phaseFormPanelSource.split(token).length - 1).toBe(0)
    }
  })
```
**With its positive control (`:718-721`):**
```ts
  it("POSITIVE CONTROL — the zero-compute needle really can find what it forbids", () => {
    const planted = "  const rows = use" + "Memo(() => models.filter(Boolean), [models])"
    expect(planted.split("use" + "Memo(").length - 1).toBe(1)
  })
```

**Exactly what it scans:** the raw source **of `PhaseFormPanel.tsx` only** (via `?raw`), for the three literal substrings `useMemo(`, `useState(`, `useEffect(`, counted by `split().length - 1`, each required to be **exactly 0**.

⚠ **Two consequences the planner must encode:**
- **`useCallback`, `useRef`, `useReducer`, `useId` are NOT in the needle set.** A refactor that reached for `useRef` would pass this pin while defeating its intent. State the *intent* ("the panel computes nothing") in the acceptance criterion, not just the pin.
- **It is a SUBSTRING scan over the whole file — comments included.** Any docblock this phase adds to `PhaseFormPanel.tsx` that spells `useState(` **turns the pin red**. That is the 187-24 trap and it has already caught three authors in this file.

**Other fences in the same file worth knowing:** `:626-631` — exactly ONE `<TemplateNameCheck` mount line, gated `pt === "llm_emit"`, forwarding `{...nameCheck}`. `:693-703` — exactly FOUR `<ModelField` mounts, one per `["llm_agent","llm_batch_agents","llm_emit","llm_single"]`, compared as a **sorted SET**, each forwarding `{...modelPicker}` and `onPersist={onPersist}`. `:705-709` — `showFitness` on the `llm_emit` mount and only it. `:723+` — absent registry ⇒ **no control at all, emphatically no free-text box** (AUTH-04). `:676-677` non-vacuity: source length > 1000 and contains `export function PhaseFormPanel`.

**`PhaseFormPanel.rails.test.tsx` — 32 pinned cases, structure measured (`grep -n "it(\|describe("`):** 8 describes / 30 `it(`s. Its own docblock (`:1-22`) records that it does **not** absorb `PhaseFormPanel.test.tsx`, and that the count-gate pins that file. Its fences most relevant here:
- `:105` "renders no rail element and none of the strings the rails introduce" (rails-absent negative) with `:114` its positive control.
- `:125` "the rails-absent and rails-present renders are NOT the same DOM (the prop is load-bearing)".
- `:335` "the panel source never names Phase 185's field" + `:339` positive control — **another `?raw` source scan** (`import phaseFormPanelSource from "./PhaseFormPanel?raw"` at `:26`).
- `:484` "`toolOptions` was NOT widened — the three capabilities are absent from the source".
- `:497` "the rail is reachable ONLY from the two tool-carrying branches, asserted on source".
- `:526` "no module other than `PhaseFormPanel.tsx` exports a phase-config form component" — **an `import.meta.glob` scan.** ⚠ **A `200-03` extraction leaf must not export something that reads as a phase-config form component**, or this fence reds. Read `:526-540` before authoring the leaf.
- `:345`/`:355` "programmatic / llm_human_input still shows no model, no tools and no folder scope" — per-type conditioning is pinned.

### C13. D-15 verified mechanically

`frontend/src/lib/api.ts:4178-4183`:
```ts
export interface WorkflowRunPhase {
  slug: string
  phase_index: number
  status: string
  phase_type: string | null
}
```
and `:4213-4235` `export interface WorkflowRunRead { … phases: WorkflowRunPhase[] }`.

**Both are `export interface` — TypeScript types, fully erased at build.** Adding `started_at?: string | null`, `completed_at?: string | null`, `count?: number`, `noun?: string` adds **zero runtime exports**. The grep the planner must run over the real diff (not over this paragraph):

```bash
git diff -U0 -- frontend/src/lib/api.ts \
  | grep -E '^\+' \
  | grep -E '^\+\s*export\s+(const|function|class|let|var|enum)\b' \
  | grep -v '^\+\s*export\s+\(interface\|type\)'
```
**Expected output: EMPTY.** A non-empty result means `196-08`'s mock-factory failure mode (nine suites throwing at mount because a `vi.mock("@/lib/api")` factory did not declare a newly-added export) becomes reachable and the 197 decline's re-open trigger fires.

⚠ **The `WorkflowRunRead` docblock at `:4200-4204` will become STALE and must be corrected in the same commit**, not left:
> *"`claimed_at` is the ONLY honest elapsed anchor. `workflow_runs` has no `started_at` and no `completed_at` (measured — `supabase/full-schema.sql`), so a duration is `updated_at − claimed_at`…"*

That stays literally true of `workflow_runs` — but the phase rows now carry both, and `min(started_at) → max(completed_at)` is a strictly better run span. **Measured why this matters:** `WorkflowRunPage.tsx:849-851` records `workflow_runs: 181 total · 5 with claimed_at · completed: 149 rows · 0 with claimed_at`. **`claimed_at` is null on 100% of completed runs.** So the phase timestamps are not a nicety on the run surface — they are the first honest total-runtime the product has ever had.

### C14. The four folded bugs — located in current source

| Report | Status in the file tree | Where |
|---|---|---|
| **`BUG-260610-01`** (timer resets on nav) | **OPEN — structurally fixed by D-05, not yet by code.** The mount-anchored timer is `WorkflowRunPage.tsx:845-877` (`const elapsed = useMemo(...)`, `fmtElapsed(nowMs - anchorMs)`). The formatter is the ONE shared `@/lib/fmtElapsed` (imported `:68`, hoisted verbatim by 194.1-06). ⚠ The report's frontmatter says `status: open` **deliberately** — the duplicate-avatar half is live and a `folded` status would hide it from the routing scan. **Do not flip it to `folded`.** | `WorkflowRunPage.tsx:735-889` |
| **`BUG-260813-01`** (canvas dark in light mode) | **OPEN, one-line symptom / three-part fix.** `colorMode="dark"` at **`WorkflowCanvas.tsx:1317`** (the report says `:1250` — **stale by 67 lines**). ⚠ **`useTheme` is NOT consumed by the canvas** — `grep -rn "useTheme" frontend/src` returns exactly: `hooks/useTheme.ts:12` (the def) and `components/layout/ChatLayout.tsx:31, :111` (the ONE consumer). **There is no `ThemeProvider` in `providers/`.** The report's analysis holds verbatim: a second `useTheme()` call forks the state. `providers/TechnicalNamesProvider.tsx:15-50` is the shipped **provider-shaped** precedent and its docblock explicitly says it is *"NOT a bare per-consumer hook — copying `useTheme.ts` verbatim"* would be wrong. **⇒ the honest fix is a `ThemeProvider` (or lifting `theme` down as a prop from `WorkflowBuilderPage`/`WorkflowRunPage`), and `TechnicalNamesProvider` is the template.** Budget this: it is a cross-surface change that lands in CHAT first. | `WorkflowCanvas.tsx:1317`, `hooks/useTheme.ts`, `providers/TechnicalNamesProvider.tsx` |
| **`BUG-260807-01`** (NaN transform) | ⚠ **ALREADY CODE-FIXED.** `editAffordance.ts:533-543` — `verticalOffsetFor` now reads `own(overlay, slug)` (`:540`) and `own(nudges, slug) ?? 0` (`:543`), with the docblock at `:511` naming `BUG-260807-01`. | `editAffordance.ts:511-543` |
| **`BUG-260808-01`** (absent transform) | ⚠ **ALREADY CODE-FIXED.** All three sinks route through `own()`: `WorkflowCanvas.tsx:699` (`own(nudges ?? {}, node.id) ?? 0`), `:738` (`own(dragOverlay, node.id)`), `:942`. Guard leaf: `frontend/src/components/workflows/ownProperty.ts` (zero imports by contract). Count-gate pin `WorkflowCanvas.editing.test.tsx` extended 63 → **65** (pinned at 65 today). | `WorkflowCanvas.tsx:699, 738, 942` |

⚠ ⚠ **CONTEXT.md IS WRONG ABOUT THE 807/808 BUDGET, and it is wrong in the SAFE direction — but the planner should know.** CONTEXT says *"Correctness defects under the rebuilt canvas… they widen `200-05` beyond D-01 deliberately, which the planner must budget for rather than discover."* Both reports' own tails say the code fix landed and **what is owed is exactly ONE driven browser row, shared by both**:
> *"THE ONE THING OWED — the driven row… Author a phase slugged `constructor`, read the affordance's computed `transform` (807's half) and the node's `style.transform` (808's half), with the slug control swung both ways. **Flip BOTH to `closed` on that one row.**"*
> *"⚠ Reproduction note: **the UI cannot author this slug.** `D-184-11` is explicit that there is no slug field… the row requires a seeded `workflow_definitions` fixture (all rows in this project are test data)."*

**⇒ Budget: one UAT row + a ~3-line Python seed fixture, not a repair.** And the CLASS is still open — `SEED-143` (constrain `slug` at the boundary) — which this phase's migration `121` *could* take (a CHECK on `workflow_phases.slug`, plus a pattern on `harness.py:202`). ⚠ **Recommend NOT taking it here:** it is a schema + API-surface change on a phase already carrying a behaviour change, and CONTEXT scoped neither.

### C15. `libraryVocabulary.ts` vs `runVocabulary.ts` — and where D-09's words should live

| | `library/libraryVocabulary.ts` (727 L) | `runVocabulary.ts` (569 L) |
|---|---|---|
| **Audience** | someone scanning 285 past workflows in a list | someone watching ONE step right now |
| **Tense / register** | settled, past, business-noun. Chip words, tier words, provenance, `Still building`, `Ready to run`, `Strict`, `Starters` | present-continuous, one-step. **Eight LOCKED canvas words** (D-188-04, D-16 for the eighth) |
| **Scope enforcement** | ⚠ **`librarySubtree.fences.test.ts` sweeps `library/*` via an EXPLICIT 14-path list + a non-recursive `import.meta.glob("./*.{ts,tsx}")`** (`:82-131`, `:169` asserts `toHaveLength(14)`, `:202` asserts the glob equals the list) | `runVocabulary.test.ts`, pinned at 23. Docblock (`:1-38`): *"one derivation, two vocabularies"*; `lib/phaseState` owns derivation and holds **no** words; this module owns words and holds **no** derivation |
| **Glyphs** | zero net-new; five of six chips carry none | **exports no glyph strings of any kind** |

⚠ **D-09's instruction needs a precise reading, and CONTEXT's wording invites the wrong one.** *"Past-tense words come from `libraryVocabulary.ts`'s register"* means **the REGISTER (the tone), not the MODULE**. Importing from `libraryVocabulary.ts` into a receipt that lives outside `library/` would:
- put library words on a non-library surface (the one-string-home-per-surface rule this repo enforces four times over: `doorVocabulary.ts`, `libraryVocabulary.ts`, `decisionsVocabulary.ts`, `runVocabulary.ts`), and
- make `LIBRARY_SUBTREE_PATHS` a list that no longer describes the subtree's blast radius.

**⇒ Recommendation: D-09 needs a NEW string home.** Site it beside its consumer, following `doorVocabulary.ts` / `decisionsVocabulary.ts`: **`frontend/src/components/workflows/receiptVocabulary.ts`**, a true leaf (type-only imports, no React), pinned in the count gate **in the same commit** that creates it (the `196-05` / `196-07` rule: *"an unpinned file is not a lightly-guarded one, it is an unguarded one"*). Its words are past-tense (`Ran 4m 12s`, `never ran (skipped)`, `time not recorded`) and must NOT duplicate any of `runVocabulary.ts`'s eight locked canvas words.

### C16. `PHASE_GLYPHS` — ⚠ **the seven-vs-eight gap DOES NOT EXIST**

`frontend/src/components/workflows/soulData.ts:57-65`:
```ts
export const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "gear",
  llm_single: "memo",
  llm_agent: "compass",
  llm_batch_agents: "handshake",
  llm_human_input: "raised-hand",
  llm_emit: "package",
  external_action: "outbox-tray",
}
```
**Seven keys.** And the backend has **seven phase types** — `PHASE_TYPE_REGISTRY_ENTRIES` (`phase_types.py:2398-2410`) and the `PhaseConfig` discriminated union (`models/harness.py:68, 77, 93, 110, 129, 154, 242`) both enumerate exactly the same seven. **The map is TOTAL over the shipped phase types.**

`llm_judge_rubric` is a **`ValidatorSpec.kind`** — `models/harness.py:350`, inside `Literal["json_schema","regex_match","workspace_file_exists","programmatic","citations_required","freshness","structure_check","output_file_valid","llm_judge_rubric","action_risk_approval"]` — registered at `validator_kinds.py:500` with `@register_validator("llm_judge_rubric")`. A validator is a **gate attached to a phase**, not a phase. It has no node, so it needs no glyph.

**⇒ THREE documents carry this error and each should be corrected:**
1. `200-CONTEXT.md` `<specifics>`: *"`llm_judge_rubric` ships in the backend with NO glyph. `PHASE_GLYPHS` in `soulData.ts` has seven keys and the backend has eight phase types… a real product gap, not a sketch problem."*
2. `.planning/ROADMAP.md` Phase 200 — inherits it via CONTEXT.
3. `.planning/sketches/200-journey-interactive/FORWARD-CHECK.md` — *"⚠ A real gap found while checking: the backend ships `llm_judge_rubric` as a phase type, and `PHASE_GLYPHS` has no key for it."* and the `node-identity` JOURNEY row's third gap entry.

**Which in-scope screen first renders a judge step? NONE — and none can.** A judge is a validator; the four in-scope screens render phases (`builder-spine` from `PhaseSpecJSON[]`, `builder-canvas` from the same, `run-surface` from `workflow_phases` rows, `step-panel` from one `PhaseSpecJSON`). ⚠ **Where a judge DOES surface is the step panel's GATES rail** — `PhaseFormPanel.rails.test.tsx:278-330` pins locked/unlocked gate rows, and `ValidatorSpec.kind` is what a gate row names. So if `200-03` composes sheet c4's sections, a `llm_judge_rubric` gate may want a human word — and **`phaseVocabulary` / `definitionOps`, not `PHASE_GLYPHS`, is where that word belongs.**

Also stale, noted in passing: `icon-convention.md` §4's last table row reads *"phase-type marks | the **6** workflow phase types"* — seven since 189 added `external_action`.

---

## D. Test surface and gates

### D17. The count-gate baseline — measured this session, VERBATIM

Command (from the repo root, quiet tree, no sibling agent):
```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs
```
Verdict lines, verbatim:
```
  total                                      4543    4970    +427
  total 4970  ·  failed 0  ·  pinned total 4543
count gate OK — 96/96 pinned files present, no per-file decrease, 0 failing.
```

| | CLAUDE.md's latest (192.2, **2026-08-19**) | **measured 2026-08-19** |
|---|---|---|
| grand total | 4594 | **4970** |
| pinned total | 4328 | **4543** |
| pinned files | 92/92 | **96/96** |

⚠ **This is the FIFTH rot of this constant, and it happened on the SAME DAY the fourth was written.** CLAUDE.md's own trajectory: `4170` (08-17) → `4594` (08-19) → **`4970` (08-19, later)**. `+376` grand / `+215` pinned / `+4` files, from Phase 199 landing. **A growing number is the gate WORKING** — its contract is *no per-file DECREASE* and *zero failing*, never a fixed total. `failed 0` on the first run at cap 2, single agent.

**Recommendation:** `200-01` re-derives this and records it as the phase baseline; every later plan compares against **that** number, not against CLAUDE.md's.

### D18. Which suites cover the §C11 files, and which are UNGATED

`TARGETS` (55 entries) includes the bare directory `"src/components/workflows"`, which sweeps everything under it. Panel files are listed individually.

| Source file | Covering suite(s) | In `TARGETS`? | Pinned count |
|---|---|---|---|
| `PhaseTimeline.tsx` | `src/components/panel/__tests__/PhaseTimeline.test.tsx` | ✅ file entry | **17** |
| `PhaseCard.tsx` | `src/components/panel/PhaseCard.test.tsx` | ✅ file entry | **27** |
| `phaseStatusMeta.ts` | *(no dedicated suite — exercised through PhaseTimeline/PhaseCard)* | ⚠ transitively | ⚠ **UNPINNED** |
| `PhaseSpineGraph.tsx` | `PhaseSpineGraph.test.tsx` | ✅ via `src/components/workflows` | **20** (24 `it(`s present ⇒ ~4 cases of slack) |
| `WorkflowCanvas.tsx` | `WorkflowCanvas.test.tsx` · `WorkflowCanvas.editing.test.tsx` · `WorkflowCanvas.composition.test.tsx` | ✅ dir | **53 / 65 / 20** |
| `FlowEdge.tsx` | `FlowEdge.test.tsx` | ✅ dir | **22** |
| `WorkflowRunPage.tsx` | `src/pages/WorkflowRunPage.test.tsx` | ✅ file entry | **108** |
| `PhaseFormPanel.tsx` | `PhaseFormPanel.test.tsx` · `PhaseFormPanel.rails.test.tsx` | ✅ dir | **38 / 32** |
| `soulData.ts` | `soulData.test.ts` | ✅ dir | **36** |
| `runVocabulary.ts` | `runVocabulary.test.ts` | ✅ dir | **23** |
| `editAffordance.ts` | `editAffordance.test.ts` | ✅ dir | **63** |
| `ownProperty.ts` | *(exercised via canvas suites)* | ⚠ transitively | ⚠ **UNPINNED** |
| `libraryVocabulary.ts` | `librarySubtree.fences.test.ts` + siblings | ✅ dir | ⚠ **no direct pin** |

⚠ **`phaseStatusMeta.ts` is the one that matters for this phase.** D-06's five (recommended six) render arms are status-vocabulary work, and **there is no suite pinned to that module**. `PhaseSpineGraph.test.tsx`'s 4 cases of slack is the second exposure — "a pinned TOTAL rising proves nothing about the NEW cases, because slack inside an already-listed file absorbs them" (the count gate's own §187-29 correction). **Recommendation: `200-06` de-slacks `PhaseSpineGraph.test.tsx` to its actual and pins any new leaf in the same commit that creates it.**

### D19. Backend test surface and baseline

**Full `tests/unit` baseline, measured this session** (`backend/venv/Scripts/python.exe -m pytest tests/unit -q`):
```
62 failed, 2350 passed, 2 xfailed, 2 xpassed, 31 warnings in 48.72s
```
(CLAUDE.md's *"62 failed / 1986 passed"* — the **failed count is stable at 62**; passed has grown to 2350. The 62 are the known SEED-era rot in `test_retrieval_service.py`, `test_sandbox_service.py`, `test_sql_service.py`, `test_streaming_reliability.py` and siblings — none in the workflow cluster.)

**Targeted baseline for the wire slice's own suites:**
```
backend/venv/Scripts/python.exe -m pytest \
  tests/test_188_workflow_run_read.py tests/test_workflow_phase_cancel.py \
  tests/test_l01_finish_run_terminal_guard.py tests/test_thread_workflow_endpoint.py \
  tests/test_harness_engine.py tests/test_harness_resume.py -q
⇒ 1 failed, 121 passed, 3 warnings in 4.42s
```
**The one pre-existing failure, named so it is not attributed to this phase:**
`tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` — `assert body["locked"] is True` → `assert False is True`. It is in the blast radius (it asserts the `ThreadWorkflowState` shape that §B10 #3 widens), so **`200-02` must record it RED-before as a baseline, not fix it silently and not let it read as a regression.**

**Files covering each target:**

| Target | Suites |
|---|---|
| `db/workflows.py` | `test_workflow_phase_cancel.py`, `test_l01_finish_run_terminal_guard.py`, `test_harness_resume.py`, `test_152_delete_cascade.py`, `test_141_run_scope.py`, `integration/test_092_harness_audit_live.py` |
| `api/workflow_runs.py` | **`test_188_workflow_run_read.py`** (the only one) |
| `phase_types.py` | `test_harness_engine.py`, `test_harness_whitelist.py`, `test_harness_templates.py`, `test_096_askuser_cleanup.py`, `test_093_split_topic.py`, `test_099_skill_composition.py`, `test_tool_budget.py`, `test_098_scope_governance.py`, plus `tests/unit/test_103_forced_emit_strict.py` etc. |
| the migration | pattern: `test_migration_115.py` / `test_migration_119.py` → **author `test_migration_121.py` the same way** |

⚠ **WHICH MUTATE THE LOCAL DATABASE (CLAUDE.md rule 4 — SERIALIZE these plans, never run them in parallel worktrees):**
- **`tests/test_migration_119.py`** connects to real Postgres — `POSTGRES_DSN` default `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (`:62`), `asyncpg.connect` at `:92`, a **function-scoped real asyncpg pool** at `:124`. Same for `test_migration_115.py`. **A new `test_migration_121.py` will too.**
- **Everything under `backend/tests/integration/`** (`test_092_harness_audit_live.py`, `test_092_subagent_parent_fk_live.py`, `test_093_ask_user_workflow_run_live.py`, `test_163_rls_workflow_eval.py`, `test_193_2_authoring_frequency.py`).
- **`tests/unit/**` and `tests/test_188_workflow_run_read.py` are fully mocked** and are safe to run concurrently.

**⇒ Planning consequence: the plan that authors + applies migration 121 and its `test_migration_121.py` MUST be dispatched ALONE**, not as one of the two concurrent plans.

### D20. `SEED-171`'s five flaky suites vs this phase's blast radius

The five (`SEED-171-workflows-library-suites-flake-independent-of-cap.md:147-149`):
`WorkflowsPage.test.tsx` · `library/WorkflowCard.test.tsx` · `WorkflowBuilderPage.session.test.tsx` · `WorkflowRunPage.test.tsx` · `WorkflowBuilderPage.canvas.test.tsx`.

| Suite | In Phase 200's blast radius? |
|---|---|
| `src/pages/WorkflowsPage.test.tsx` | ❌ library screen deferred |
| `src/components/workflows/library/WorkflowCard.test.tsx` | ❌ library screen deferred |
| `src/pages/WorkflowBuilderPage.session.test.tsx` | ⚠ **adjacent** — `200-03`/`200-04` edit `WorkflowBuilderPage.tsx`'s two mounts |
| **`src/pages/WorkflowRunPage.test.tsx`** | ✅ **YES — `200-06`'s primary suite, pinned at 108** |
| **`src/pages/WorkflowBuilderPage.canvas.test.tsx`** | ✅ **YES — `200-05` edits the canvas; this suite is in `TARGETS` as a file entry** |

**TWO of five, plus one adjacent.** The triage procedure is CLAUDE.md's, verbatim in substance: **do NOT reach for the cap.** Capture failing filenames from the gate's **own persisted JSON report** *before* any re-run, check each named file against `git diff --numstat <base> HEAD` and `git status --short`, and if it is byte-unchanged and one of the five, record it as an observation. ⚠ **One green sample is not proof of innocence** — say "provably unmodified", never "fine". ⚠ **And red is sometimes REAL** — `196-08` hit `failed 249` because nine suites' `@/lib/api` mock factories did not declare a newly-added export. §C13's grep is what keeps that from being reachable here.

⚠ **Consequence for the plan's acceptance criteria:** `count gate OK` is **not reliably reachable on demand**, so *"the gate is green"* is a criterion that can fail for reasons no plan controls. **Pair it with per-file deltas and the explicitly-run in-scope suites**, which are deterministic.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Formatting a duration | a fourth elapsed formatter | **`@/lib/fmtElapsed`** (`WorkflowRunPage.tsx:68`) | The tree already carried THREE (`RunCard.formatElapsed`, `MessageList.formatFloatingElapsed`, the run page's own) before 194.1-06 hoisted this one. A fourth is the drift the hoist existed to stop. |
| A keyed presentation-table lookup | `TABLE[key] ?? fallback` | **`own()` from `frontend/src/components/workflows/ownProperty.ts`** (zero imports by contract) | `TABLE["constructor"]` returns a function, which is not nullish, so the coalesce never fires. This is `BUG-260807-01` / `BUG-260808-01` / WR-04, seven sinks and counting. **See §E-R5 — an EIGHTH one is live in `PhaseFormPanel.tsx`.** |
| The DB status → client union mapping | a second mapping | **`@/lib/phaseState`'s `DB_PHASE_STATUS` (`:59`) + `phaseStatusFromDb` (`:110`)** | `api.ts:4172`'s docblock says it outright: *"this client must never grow a second one."* |
| A theme value inside the canvas | a second `useTheme()` call | a **`ThemeProvider`**, modelled on `providers/TechnicalNamesProvider.tsx` | `BUG-260813-01`'s own analysis: a second hook call forks `useState`, both effects write `localStorage` and toggle the root class, and neither re-renders the other. |
| A run-tense variant of a component | a second component | an **OPTIONAL prop, absent ⇒ byte-identical** | The house pattern, three times over: `WorkflowCanvas.runState`, `WorkflowCanvas.editable`, `PhaseFormPanel.rails`. `PhaseFormPanel.rails.test.tsx:125` even pins that the prop is load-bearing. |
| A per-phase `duration_ms` column | one computed column | two nullable `timestamptz` | D-05. Timestamps additionally give "when", a live tick, a true span, and wait-to-start. |
| A structural count over `output` | `len(first_list_you_find)` | a **declared** `{count, noun}` from the executor | D-07, and `harness_engine.py:142` stores the dict full-inline so shapes differ per type and no key marks "the thing produced". |
| An edge-label counting path | a second counter on the canvas | the existing **`runState?: (slug) => NodeRunState \| undefined`** seam (`WorkflowCanvas.tsx:567`) | D-08. `FlowEdge.tsx` already renders labels (`DETOUR_ARMED_LABEL`, `DETOUR_OPEN_LABEL`). |
| Icon marks for the new atoms | Material Symbols ligatures copied off the sketch | `icon-convention.md` §1/§2/§4 authorities | §A2 N-5. A net-new mark must be FLAGGED as a proposal, never passed off as shipped vocabulary. |

---

## Common Pitfalls

### Pitfall 1 — Widening the model but not the projection
**What goes wrong:** `WorkflowRunPhaseRead` gains `started_at`; the run page renders nothing. **Why:** `api/workflow_runs.py:230`'s `.select("slug, phase_index, status")` never asked Postgres for it, so the serializer reads `row["started_at"]` → `KeyError` or `None`. **How to avoid:** widen all THREE — `.select()`, model, serializer — and add a fence. **Warning sign:** a green backend test beside an unchanged UI. That is 192.2's exact signature.

### Pitfall 2 — Trusting `_FakeQuery` to model PostgREST
**What goes wrong:** the new wire test passes while the real route drops the column. **Why:** `test_188_workflow_run_read.py:121-122`, `def select(self, *_columns, **_kwargs): return self`. **How to avoid:** make `execute()` project to the requested columns, with a positive control asserting an unselected key is absent. **Warning sign:** a test that would still pass if you deleted the `.select()` line.

### Pitfall 3 — Implementing the pause as a `CancelledError`
**What goes wrong:** the prompt is expired out from under the person and the phase flips to `cancelled`. **Why:** `harness_engine.py:1632` expires the prompt whenever `not is_app_shutting_down()`, and `:1707-1709` calls `cancel_phase` for any `CancelledError`. **How to avoid:** a new `PhaseOutcome` kind with its own arm. **Warning sign:** a paused run whose spine shows the human step as Stopped.

### Pitfall 4 — Reusing `finish_run` to write `paused`
**What goes wrong:** the run pauses and can never resume. **Why:** `finish_run` clears `threads.active_workflow_run_id` in the same transaction (092 SC#2), and `find_resumable_runs` requires that anchor. **How to avoid:** a separate `pause_run` writer. **Warning sign:** the boot sweep finds nothing after a restart.

### Pitfall 5 — Only six write sites
**What goes wrong:** a Stop landing with no producer running (`cancel_active_phases`, `db/workflows.py:1649`) leaves `completed_at` NULL on a `cancelled` row, so D-06's `cancelled → ran 8.1s, interrupted` arm renders "time not recorded" on the one path 194 was built for. **How to avoid:** seven. **Warning sign:** the arm that never fires in UAT.

### Pitfall 6 — A docblock that spells its own forbidden token
**What goes wrong:** `PhaseFormPanel.test.tsx:711`'s ABSOLUTE-ZERO pin goes red on a comment. **Why:** it is a substring scan over `PhaseFormPanel?raw`, comments included. **How to avoid:** build tokens, never spell them (the file's own `"use" + "State("` idiom). **Warning sign:** the pin reds on a plan whose only change to that file is prose. This has caught three authors in this file already.

### Pitfall 7 — Drawing BS-4 and BC-1 from the sketch HTML
**What goes wrong:** the checklist silently omits the two atoms that justify the whole backend slice. **Why:** neither proposed screen draws them (§A4). **How to avoid:** derive those two from the ledger `note` + sheet c3 col 3 / c1, and SAY in §0 that they are ledger-derived rather than screen-derived. **Warning sign:** a `builder-spine` checklist with no duration atom.

### Pitfall 8 — `0` treated as absence
**What goes wrong:** a search step that found nothing renders no count, so "we looked and found nothing" is indistinguishable from "this step doesn't count things". **Why:** `source_refs: []` is a REAL fact. **How to avoid:** the client's arm must be `hasOwnProperty`-shaped, never `count ?? …` or `if (count)`. **Warning sign:** `SEED-159`'s silent blank, re-shipped.

---

## Code Examples

**The `own()` guard — the house idiom (`WorkflowCanvas.tsx:738`, `editAffordance.ts:540`):**
```ts
import { own } from "./ownProperty"
const live = own(overlay, slug)          // NOT overlay[slug]
return own(nudges, slug) ?? 0            // safe: own() returns undefined for inherited keys
```

**The TOTAL status lookup with an explicit unknown row (`phaseStatusMeta.ts:177-180`):**
```ts
export function statusMeta(status: Phase["status"]): StatusMeta {
  if (!Object.prototype.hasOwnProperty.call(STATUS_META, status)) return STATUS_META.unknown
  return STATUS_META[status]
}
```

**The optional-prop, absent-is-byte-identical seam (`WorkflowCanvas.tsx:567`):**
```ts
  runState?: (slug: string) => NodeRunState | undefined
```
mounted with it on the run surface (`WorkflowRunPage.tsx:1091-1099`) and without it on the builder (`WorkflowBuilderPage.tsx:2106`).

**A migration in house style (shape from `119_workflow_phases_cancelled.sql`):**
```sql
BEGIN;
ALTER TABLE public.workflow_phases
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
COMMENT ON COLUMN public.workflow_phases.started_at IS
  'Phase 200 (DES-02 / D-05). Set at the mark_phase_active transition. NULL on every pre-200 row by decision — NO BACKFILL (a backfill from updated_at is right for some rows and silently wrong for others).';
COMMENT ON COLUMN public.workflow_phases.completed_at IS
  'Phase 200 (DES-02 / D-05). Set at each of the SIX terminal transitions AND at cancel_active_phases (db/workflows.py:1649 — the seventh site, the engineless Stop arm).';
COMMIT;
```
*(Apply by pasting into the Supabase SQL editor — never `db push` / `db reset` — then `bash scripts/regenerate-full-schema.sh` with no `--reset`, and commit the regenerated artifact.)*

---

## E. Risks

### R1 — `paused` has no writer and no resume path; D-10 is a bigger change than CONTEXT says
**Evidence:** `grep -rn "'paused'" backend/app --include=*.py` → 7 hits, **all reads**. The only `UPDATE workflow_runs SET status` writer is `finish_run` (`db/workflows.py:1754`), which clears the thread anchor. `find_resumable_runs` (`:1250`) is called only from `main.py:406-408`'s boot sweep. `POST /runs/{id}/ask_user_response` publishes to a Redis channel with no subscriber once the executor has timed out.
**Mitigation (encode as tasks):** (1) a new `pause_run(pool, run_id)` writer that does **not** touch the anchor; (2) a new `PhaseOutcome("pause_run", …)` kind + an engine arm that leaves the phase `active` and does NOT call `_expire_pending_ask_user`; (3) an answer-triggered re-drive in `submit_ask_user_response` reusing `_build_resume_context`; (4) an acceptance criterion worded *"a run paused by timeout, then answered, RESUMES WITHOUT A RESTART"* — driven, not unit-asserted.

### R2 — The two amber atoms that justify the phase are not drawn on the sketch's own screens
**Evidence:** text extraction of `screens/builder-spine.html` shows no duration and no total runtime; `screens/builder-canvas.html` shows no payload label. Both are ledger `note` rows referencing sheets c3 col 3 / c1 of sketch **178**.
**Mitigation:** `200-01`'s §0 states explicitly that BS-4 and BC-1 are **ledger-derived, not screen-derived**, and cites sketch 178's c3/c1 as their drawing source. Acceptance criterion: the `builder-spine` and `builder-canvas` checklists each contain at least one `MUST RENDER` atom sourced from the amber row.

### R3 — RS-3's execution trace is finer-grained than the slice
**Evidence:** `screens/run-surface.html` draws eight trace lines at `00:00 / 00:02 / 00:05 / 00:08 / 00:15 / 00:22 / 00:35 / 00:42` for a run with **five** spine steps. Several lines (`Connecting to Northwind CRM instance…`, `Analyzing risk factors`) are **sub-step** events. The slice is phase-level only.
**Mitigation:** split RS-3 into RS-3a (**total runtime + per-step start/finish — IN the slice**) and RS-3b (**a sub-step trace — REPORT with a named re-open trigger**, because the substrate would be `harness_audit` events / `EmitSubStep`, which is a second backend concern). Do this in `200-01`, not in `200-06`.

### R4 — Two of `SEED-171`'s five flaky suites are the primary suites of `200-05` and `200-06`
**Evidence:** §D20. `WorkflowRunPage.test.tsx` (pinned 108) and `WorkflowBuilderPage.canvas.test.tsx` are both named in `SEED-171:147-149`.
**Mitigation:** every plan touching those files states the triage procedure inline (capture filenames from the persisted JSON BEFORE re-running; check against `git diff --numstat`; never adjust the cap). Acceptance criteria name **per-file deltas + explicitly-run in-scope suites**, not "the gate is green".

### R5 — ⚠ **An EIGHTH live WR-04 sink sits inside `200-03`'s primary file**
**Evidence, executed:** `frontend/src/components/workflows/PhaseFormPanel.tsx:873-883`
```ts
/** Map a raw tool id to a friendlier reading (best-effort; falls back to the id). */
function friendlyToolName(id: string): string {
  const map: Record<string, string> = {
    search_documents: "Search documents",
    read_document: "Read a document",
    execute_code: "Run code",
    fetch_url: "Fetch a web page",
    list_folders: "List folders",
  }
  return map[id] ?? id
}
```
`map["constructor"]` resolves the inherited `Object.prototype.constructor` — a **function**, never nullish — so `??` never fires and a **function is returned into JSX** at three call sites (`:638`, `:733`, `:791`). Tool ids reach this from `available_tools`, which on the **non-rails** variant is a **free-text comma field** the author types (`PhaseFormPanel.rails.test.tsx:90` pins that field's existence). Same class as `BUG-260807-01`/`-08-01`, same `?? fallback` shape the repo has now fixed seven times.
**Mitigation:** `200-03` routes it through `own()` from `ownProperty.ts`, RED-first (a case asserting `friendlyToolName("constructor") === "constructor"`), and the map moves out of the panel if the leaf-extraction lands anyway. ⚠ **Also note `friendlyToolName` has FIVE entries, not the "3 of 27 named" the SP-1 ledger row states** — SP-1's own number is stale, and `200-01` should re-measure it against `rails.toolOptions` rather than inherit it.

**Runner-up risks, listed rather than dropped:** the `BUG-260813-01` fix needs a `ThemeProvider` and therefore lands in CHAT first (`ChatLayout.tsx` is the sole `useTheme` consumer) — a cross-surface change on a phase already carrying a backend behaviour change; and `phaseStatusMeta.ts` is **unpinned** while being the natural home for D-06's arms.

---

## R22 / CONTEXT.md corrections — measured, not inferred

| # | CONTEXT.md / ROADMAP says | Measured | Impact |
|---|---|---|---|
| **X-1** | D-05: *"six sites (`1441,1483,1505,1517,1548,1597`)"* | **SEVEN.** `cancel_active_phases` at **`db/workflows.py:1649`** is the run-keyed engineless-Stop arm. All six named lines are exact. | A hole on the Stop-with-no-producer path |
| **X-2** | `<specifics>`: *"`llm_judge_rubric` ships in the backend with NO glyph… seven keys and the backend has eight phase types… a real product gap"* | **REFUTED.** Seven phase types (`phase_types.py:2398-2410`; `models/harness.py`'s seven-member `PhaseConfig` union) and seven `PHASE_GLYPHS` keys. `llm_judge_rubric` is a **`ValidatorSpec.kind`** (`harness.py:350`, `validator_kinds.py:500`). | A non-existent gap in three documents; D-07's "eight types" should read seven |
| **X-3** | `<code_context>`: *"The run status vocabulary already contains `paused`… D-10 needs no new literal"* | **True of the CONSTRAINT, misleading about the CODE.** No writer exists anywhere; `finish_run` is unusable (anchor clear); no resume path exists outside the boot sweep. | R1 — the largest under-estimate in the file |
| **X-4** | `<canonical_refs>`: *"`phase_types.py:765-856` — the human-input executor"*; `BUG-260816-06`: *"`:818-856`"* | At HEAD: def `:760`, `subscribe_for_response` `:851`, shutdown branch `:866`, `answer = ""` **`:872`**, return `:888`. | ~54-line drift; re-derive |
| **X-5** | `BUG-260813-01`: *"`WorkflowCanvas.tsx:1250` — `colorMode="dark"`"* | **`:1317`** | 67-line drift |
| **X-6** | *"`BUG-260807-01` / `BUG-260808-01` … Correctness defects under the rebuilt canvas … the planner must budget for it"* | **Both are CODE-FIXED.** `own()` at `editAffordance.ts:540,543` and `WorkflowCanvas.tsx:699,738,942`. Both reports' tails say what is owed is **ONE driven browser row with a seeded fixture**, and to flip both on it. | The budget is a UAT row + a 3-line fixture, not a repair |
| **X-7** | D-14: `PhaseFormPanel.tsx` `22 / 10 / 1290` | **`22 / 11 / 1290`** — phases 11 | Cosmetic; still fires |
| **X-8** | D-14: `api.ts` `174 / 99 / 6357` | **`174 / 101 / 6357`** | Cosmetic; still fires hardest |
| **X-9** | `<canonical_refs>`: *"⚠ `SEED-148`'s trigger FIRED and the seed's `status: open` is STALE"* + *"Action owed: correct `SEED-148`'s frontmatter"* | **ALREADY DONE.** `SEED-148`'s frontmatter now carries the 2026-08-19 correction inline. | The action is discharged; do not re-plan it |
| **X-10** | CONTEXT names only `api/workflow_runs.py`'s wire model | **THREE more narrowings**: `api/workflow_runs.py:230`'s `.select()`; `api/threads.py:1191`'s raw SQL + `models/thread.py:48` `WorkflowPhaseState`; `db/workflows.py:1240` `load_run_phases` / `:1331` `get_active_phase` SELECT lists | A run page with durations and a chat panel without them |
| **X-11** | D-09: *"Past-tense words come from `libraryVocabulary.ts`'s register"* | The MODULE is fenced to `library/**` by an explicit 14-path list (`librarySubtree.fences.test.ts:82,169,202`). The REGISTER is what D-09 means. | D-09 needs a **new** string home; recommend `receiptVocabulary.ts` |
| **X-12** | CLAUDE.md gate figures `4594 · 4328 · 92/92` (192.2, 2026-08-19) | **`4970 · 4543 · 96/96 · failed 0`** — the FIFTH rot, same day | `200-01` re-derives and publishes the phase baseline |
| **X-13** | SP-1 ledger row: *"3 of 27 named"* | `friendlyToolName` has **FIVE** entries (`PhaseFormPanel.tsx:874-883`) | Re-measure the row in `200-01` |
| **X-14** | sketch `README.md`: *"the six real captures"* | **SEVEN** files in `200-journey-now/`; `now-07-chat-panel.png` is referenced by no `JOURNEY` row | Cosmetic; note so `200-01` does not hunt a pairing |
| **X-15** | `icon-convention.md` §4: *"phase-type marks — the **6** workflow phase types"* | **7** since 189 added `external_action` | Correct if `200-05` touches §4 anyway |
| **X-16** | D-16 names ONE file owing a ledger row | **FOUR do.** `api/workflow_runs.py` (3/3/260, at threshold) · **`PhaseTimeline.tsx` (7/5/267 — FIRES, no row)** · `phaseStatusMeta.ts` (2/2/206, no row) · `FlowEdge.tsx` (2/2/378, no row) | The `WorkflowsPage.tsx`-for-ten-phases failure, again. Add rows for the two below threshold too — *"listed BELOW the threshold on purpose"* is the ledger's own precedent |

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|---|---|---|---|
| Elapsed anchored on `claimed_at` | `claimed_at` measured null on **0 of 149 completed runs** (`WorkflowRunPage.tsx:849-851`); the page falls back | 188 F3 UAT | Phase timestamps give the first honest run span |
| Three elapsed formatters in the tree | ONE — `@/lib/fmtElapsed` | 194.1-06 | Use it |
| Bare `TABLE[key]` lookups | `own()` from a zero-import leaf | 188.1-04 → 188.2 → the 807/808 fixes | Seven sinks fixed; §E-R5 is an eighth |
| `phase_types.py` a single monolith | package split by concern (`programmatic`, `emitters`, `validator_kinds`, `grounding`, `publish_service`) | 101→190 | D-13's extraction is in keeping |
| Extraction as a separate refactor phase | **Extraction as the VEHICLE for a fix** — `threads.py` → `run_transport.py`, the re-import load-bearing | 2026-08-17 | D-13's exact shape |

**Deprecated / not to be relied on:** `WorkflowRunPhaseRead.status`'s prose description (the migration-119 ARRAY is the authority — the description was wrong for a whole phase); migration 115's header pointer to `db/workflows.py:965,979,1001,1013` (stale by ~240 lines and one short — the file says so itself).

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| `node` | count gate, vitest, tsc | ✓ | ran the gate to completion | — |
| `backend/venv/Scripts/python.exe` | pytest | ✓ | ran 2350 tests in 48.7 s | — |
| local Supabase Postgres `:54322` | migration 121 apply + `test_migration_121.py` | **NOT MEASURED this session** | — | `test_migration_119.py:35` documents a **clean skip** when `:54322` is unreachable — copy that skip. ⚠ If unreachable, CLAUDE.md's Windows port-reservation trap is the first thing to check (`netsh int ipv4 show excludedportrange protocol=tcp`, look for an UNMARKED range straddling 54322). |
| Supabase SQL editor | applying migration 121 | operator-gated | — | none — CLAUDE.md forbids `db push` / `db reset` outright |
| `git` | ledger re-derivation, diff greps | ✓ | — | — |
| Chrome MCP | G-4 driven UAT rows (the 807/808 row, the light-mode row, the pause row) | **NOT MEASURED** | — | MEMORY records `take_screenshot` times out; **read DOM geometry via `evaluate_script`** |
| `graphify` graph | optional research context | ✗ — `.planning/graphs/graph.json` absent | — | none needed |

---

## Validation Architecture

*(`workflow.nyquist_validation` is `true` in `.planning/config.json`.)*

### Test Framework

| Property | Value |
|---|---|
| Frontend framework | **vitest** + `@testing-library/react`, jsdom |
| Frontend config | `frontend/vitest.config.ts` (+ `frontend/tsconfig.app.json` for typecheck) |
| Frontend gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` — **run from the repo root** |
| Frontend quick run | `cd frontend && npx vitest run <path> --reporter=basic` |
| Backend framework | **pytest** |
| Backend config | `backend/pytest.ini` / `backend/tests/conftest.py` |
| Backend quick run | `backend/venv/Scripts/python.exe -m pytest <file> -q --no-header` |
| Backend full suite | `backend/venv/Scripts/python.exe -m pytest tests/unit -q` |
| Typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (⚠ bare `tsc --noEmit` checks ZERO files — MEMORY) |

### Phase requirements → test map

| Req / SC | Behaviour | Layer | Automated command | Exists? |
|---|---|---|---|---|
| **SC#1** | Every in-scope screen's checklist reports `N/N` or names the miss; `MUST NOT RENDER` checked as strictly as `MUST RENDER` | **document + per-screen negative fences** | per screen: `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx` etc. with `?raw` negative sweeps | ❌ **Wave 0** — the `MUST NOT RENDER` half needs a fence per screen (the `?raw` + built-token idiom). ⚠ `199-03`'s lesson: **a `?raw` source regex and a `queryAllByRole("button")` filter BOTH passed green against a planted violation** — only a role-SET scan went red. Author the fence to be falsifiable. |
| **SC#2** | `started_at`+`completed_at` written at **all seven** sites; spine + run surface render a real duration and total runtime; `never ran` vs `not recorded` provably distinct | unit (backend) + route TestClient + component | `pytest tests/test_workflow_phase_cancel.py tests/test_l01_finish_run_terminal_guard.py -q`; `pytest tests/test_188_workflow_run_read.py -q`; `npx vitest run src/components/panel/__tests__/PhaseTimeline.test.tsx src/pages/WorkflowRunPage.test.tsx` | ⚠ partial — the seventh site and the distinct-render arms are **Wave 0** |
| **SC#3** | A count appears ONLY where the type declared one; no `0`, no dash; the canvas edge label is the SAME declared count | unit (backend, per executor) + component (canvas edge) | `pytest tests/test_harness_engine.py -q`; `npx vitest run src/components/workflows/FlowEdge.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` | ❌ **Wave 0** — needs a per-type table test asserting the three no-count types emit **no key at all** |
| **SC#4** | An unanswered `llm_human_input` **pauses and never approves**, against the measured 300 s default | unit (backend) + **manual UAT** | `pytest tests/test_096_askuser_cleanup.py tests/test_harness_resume.py -q` + a new `tests/test_200_human_gate_pause.py` | ❌ **Wave 0.** ⚠ The unit half can only prove the executor's return; **the resume half (answer-after-pause) is manual** — no automated path drives Redis pub/sub + a re-drive |
| **SC#5** | Migration applies via SQL editor + `full-schema.sql` regenerated; `tsc -p tsconfig.app.json --noEmit` unmoved; count gate `failed 0`, no per-file decrease; every touched suite green; the extraction changes no behaviour beyond the human-gate fix | gate + **manual (operator apply)** | `node scripts/check-deploy-drift.sh`-adjacent: `bash scripts/regenerate-full-schema.sh`; `npx tsc -p tsconfig.app.json --noEmit`; `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`; `pytest tests/unit -q` | ⚠ partial — **the extraction's no-behaviour-change claim needs a characterization pin authored BEFORE the cut** (188.1's most expensive lesson) |

### Sampling rate

- **Per task commit:** the touched suite only — `npx vitest run <file>` / `pytest <file> -q`.
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) **+** `pytest tests/unit -q` (expect **62 failed / 2350 passed** baseline, and re-derive it — it moved once already) **+** `npx tsc -p tsconfig.app.json --noEmit`.
- **Phase gate:** full suite green + the four driven UAT rows below, before `/gsd:verify-work`.

### Wave 0 gaps

- [ ] `backend/tests/test_migration_121.py` — the columns exist, are nullable, and **no row was backfilled** (a negative control). Copy `test_migration_119.py`'s clean-skip shape. **⚠ mutates the local DB — serialize this plan.**
- [ ] **A characterization pin on `phase_types.py`'s human-input executor, committed BEFORE the D-13 cut** — the `192.2-02` / `WorkflowDoorSwitch.baseline.test.tsx` discipline: *"a baseline taken after the edit proves the edit against itself."*
- [ ] `_FakeQuery.select` projection in `test_188_workflow_run_read.py`, with a positive control asserting an **unselected** key is ABSENT (§B6).
- [ ] A per-executor count table test — seven rows, three asserting **no key emitted**, and `source_refs: []` asserting `count: 0` is emitted (Pitfall 8).
- [ ] `backend/tests/test_200_human_gate_pause.py` — timeout ⇒ run `paused`, phase still `active`, prompt NOT expired, `finish_run` never called, anchor intact.
- [ ] Per-screen `MUST NOT RENDER` fences (four), each with a **planted-violation positive control** that goes red (199-03's blind-guard lesson).
- [ ] Pin any new leaf (`receiptVocabulary.ts`, a `FieldGuidance`-style disclosure leaf, `ThemeProvider`) in `scripts/vitest-count-gate.cjs` **in the same commit that creates it**.
- [ ] De-slack `PhaseSpineGraph.test.tsx` (pinned 20, running ~24) and add a pin for `phaseStatusMeta.ts`.

### UAT scoreboard — which axes apply (CLAUDE.md's recipe)

This phase touches **the agent loop's phase executors and UI state**, so ROADMAP SC#10 fires and the four axes apply.

| Axis | Applies? | Row shape |
|---|---|---|
| **Cross-provider** | ✅ **YES — the FULL native roster + OpenRouter, 8 rows.** `_exec_llm_agent` / `_exec_llm_batch_agents` / `_exec_llm_emit` all gain a declared count, and emission behaviour differs by `emit_tier` (Moonshot is the only `coerce` tier; DeepSeek's `strict_json_schema` is inert per D-122-04). **Derive the roster from `MODEL_CAPABILITIES` by grouping on `provider`, newest per group, registry-backed ids only** — never re-type the list. A blocked provider is ⛔ **with its reason and blocking id**, never omitted. | one real run per provider via a per-request `model` + `provider` on `POST /threads/{id}/messages`, verdicts read from `workflow_runs` / `workflow_phases` / `harness_audit` — **no global setting mutated** |
| **Multi-tool** | ✅ | one workflow whose `llm_agent` step uses `search_documents` **+** `execute_code`, asserting the declared source count is the retrieval fact and not the tool count |
| **Parallel-thread** | ✅ | Thread A streaming a workflow while Thread B accepts a new prompt — the per-step tick in A must not reseed. Directly exercises `BUG-260610-01`. |
| **Long-message** | ✅ | ≥ 50 prior messages OR a ≥ 5 KB kickoff, confirming the panel timeline and the run page agree on durations |

**G-4 lived-experience rows the operator must define at scope time (Chrome MCP drives all three; wire format + screenshot are insufficient):**
1. Navigate away from a running workflow and back — **the elapsed reading continues rather than restarting** (`BUG-260610-01` timer half).
2. Toggle light mode with the canvas open, **on both the builder and the run page** — the plane follows, and toggling in `ChatLayout` re-renders the canvas (`BUG-260813-01`; a forked `useTheme` passes on first load and fails here).
3. Start a workflow with an `llm_human_input` step, **walk away past 300 s, come back and answer** — the run reads **paused**, the prompt is still answerable, and answering **resumes it without a restart** (`BUG-260816-06` / D-10 / R1).
4. Seed a `workflow_definitions` fixture whose middle phase is slugged `constructor`, read `node.style.transform` and the affordance's computed transform **with the slug control swung both ways** — flips **BOTH** `BUG-260807-01` and `BUG-260808-01` to `closed` (§C14).

---

## Security Domain

*(No `security_enforcement` key in `.planning/config.json` ⇒ enabled.)*

### Applicable ASVS categories

| Category | Applies | Standard control here |
|---|---|---|
| V2 Authentication | no | Unchanged. The route consumes `canvas_caller` (WR-08) rather than re-running the shared resolver. |
| V3 Session Management | no | Unchanged |
| **V4 Access Control** | **YES** | ⚠ **The IDOR posture on `GET /workflow-runs/{id}` is the module's primary deliverable** (`api/workflow_runs.py:24-47`): `id` AND `user_id` filtered on the SAME select, `.maybe_single()`, **404 never 403**, `Depends(require_canvas())` **standing ALONE**. Widening the phase read must not add a second query, must not add a dependency to that list, and must not change any 404 body. `test_188_workflow_run_read.py` tests 1, 2 and 6 pin this. Also: `workflow_phases` RLS is the 4-policy 2-hop chain and **names no columns**, so new columns inherit it. |
| **V5 Input Validation** | **YES** | ⚠ `workflow_phases.slug` is unconstrained `text` (`058:18`) and `harness.py:202` is a bare `str`. **This is the open CLASS behind `SEED-143`.** New client-side lookups keyed by slug (edge labels, receipt rows, count maps) MUST use `own()`, never `TABLE[slug] ?? fallback`. §E-R5 is a live instance in `200-03`'s own file. |
| V6 Cryptography | no | Nothing cryptographic |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| **WR-04 prototype pollution via author-supplied slug/tool-id keys** | Tampering | `own()` from `ownProperty.ts`; never `?? fallback` on an object-literal lookup. Seven sinks fixed; **an eighth found this session (§E-R5)** |
| **IDOR on a guessable run uuid** | Information Disclosure | ownership + id on ONE select → 404; user-JWT client so RLS backs it; never a second query (a timing channel) |
| **Silent approval of a human gate** | Repudiation / Elevation | D-10. `BUG-260816-06` measured 4 of 5 real runs approving with `answer: ""`. **The pause must be provable, and it must never fail OPEN.** |
| SQL injection | Tampering | `$N` placeholders only in `db/workflows.py`; PostgREST builders in `api/workflow_runs.py`. No string interpolation anywhere in the slice. |
| Cross-tenant read through a widened select | Information Disclosure | The widened `.select()` adds columns to a query **already scoped** by `.eq("workflow_run_id", run["id"])` where `run` came from the ownership select. No scope widens. **State this explicitly in the plan** — a reviewer will ask. |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `len(source_refs)` is the right count for `llm_agent`, `len(sub_run_ids)` for `llm_batch_agents`, `len(field_map)` for `llm_emit`, and the nouns are `sources` / `agents` / `fields` | §B7 | These are the only real numbers in those return dicts (measured), but **the choice of NOUN is a product decision the operator has not made.** `200-01` or discuss should confirm the three words. |
| A2 | Option **(b)** (answer-triggered re-drive) is the right D-10 shape | §B8 | If the operator prefers (c), the timeout constant and `ask_user_max_timeout_seconds` interact and the plan changes shape. |
| A3 | A fifth D-06 arm — `active` on a terminal run ⇒ "did not finish" | §B4 | Without it a crashed run shows a live-ticking clock forever. Not in CONTEXT; needs confirming. |
| A4 | `receiptVocabulary.ts` is the right home for D-09's words | §C15 | If the receipt is judged part of the run surface's vocabulary, it might belong beside `runVocabulary.ts` — but the two registers differ, so a shared module would be the defect. |
| A5 | Migration number **121** | §B5 | Free at the time of writing; re-check `ls supabase/migrations/ \| sort -V \| tail -1` at plan time. |
| A6 | RS-3 splits into 3a (in slice) and 3b (report) | §E-R3 | If the operator reads the trace as in-scope, `200-02` grows a sub-step event concern and the phase grows a fourth backend concern. |
| A7 | The count rides in `workflow_phases.output` jsonb rather than in new columns | §B7 | CONTEXT `<code_context>` states it; measured viable (`_persist_output` full-inline). But it forces `output` into the API `.select()`, which returns the FULL executor dict to the client — **including `field_map`, `citations` and prompts.** ⚠ **That is a payload-size and information-exposure consideration nobody has weighed.** A narrow computed projection, or two small columns, may be safer. **Flag for discuss.** |
| A8 | Chrome MCP can drive the four G-4 rows | §F | `take_screenshot` is recorded as timing out; DOM geometry via `evaluate_script` is the fallback. Not exercised this session. |

---

## Open Questions

1. **How does a paused run resume?** — What we know: no writer, no re-drive path outside the boot sweep (§B8, measured). What's unclear: whether the operator wants (b) an answer-triggered re-drive or (c) no timeout at all. Recommendation: **take (b)** and make it an explicit SC#4 clause; it is the only option under which D-10's own sentence is true.
2. **Does the count ride in `output` jsonb, given A7's exposure question?** — What we know: `_persist_output` is full-inline; the API does not currently select `output`. What's unclear: whether returning the whole executor dict to the browser is acceptable. Recommendation: a **narrow projection** — either two small columns (`step_count int`, `step_noun text`) or a server-side computed `{count, noun}` extracted from `output`, never the raw jsonb on the wire.
3. **What are the three nouns?** (§A1) Recommendation: confirm at plan time; they are user-visible copy and D-07 says the noun is the step's own.
4. **Does `200-05` take `SEED-143`'s class fix (constrain `slug` at the boundary) while migration 121 is open?** Recommendation: **no** — schema + API surface on a phase already carrying a behaviour change. Record the deliberate decline with the trigger *"the next phase that opens a `workflow_phases` migration for another reason."*
5. **NOT MEASURED: is local Supabase `:54322` currently reachable?** Would need `netsh int ipv4 show excludedportrange protocol=tcp` plus a TCP connect (or `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`). The migration-121 plan cannot be scheduled honestly without this.

---

## Sources

### Primary (HIGH confidence — read this session, file:line cited throughout)
- `backend/app/db/workflows.py` — batch INSERT `:334`; the SEVEN status writers `:1441,1483,1505,1517,1548,1597,1649`; `load_run_phases:1231`; `find_resumable_runs:1250`; `get_active_phase:1325`; `finish_run:1670-1760`
- `backend/app/api/workflow_runs.py` — full file (260 L)
- `backend/app/api/threads.py:1190-1260` — the reconcile
- `backend/app/models/thread.py:48-60` — `WorkflowPhaseState`
- `backend/app/models/harness.py:68,77,93,110,129,154,242` (the seven `phase_type` literals), `:135` (`timeout_seconds: int = 300`), `:202` (`slug: str`), `:350` (`ValidatorSpec.kind`)
- `backend/app/services/harness/phase_types.py` — all seven executors, `:2398-2424` the registry
- `backend/app/services/harness/programmatic.py:36-118`
- `backend/app/services/harness/validator_kinds.py:500`
- `backend/app/services/harness_engine.py:113,565,579,931,1431,1585-1594,1616-1716,1950-1978,2066`
- `backend/app/main.py:405-408`
- `backend/app/api/runs.py:503-652`
- `supabase/migrations/058_workflow_phases.sql`, `119_workflow_phases_cancelled.sql`, `014_folders.sql:52-63`, `supabase/full-schema.sql:434-441`
- `frontend/src/lib/api.ts:4166-4235`; `frontend/src/lib/phaseState.ts:59,110,151,188,256`
- `frontend/src/components/panel/phaseStatusMeta.ts` (full); `PhaseTimeline.tsx`; `PhaseCard.tsx`
- `frontend/src/components/workflows/` — `PhaseSpineGraph.tsx`, `WorkflowCanvas.tsx`, `FlowEdge.tsx`, `PhaseFormPanel.tsx`, `soulData.ts:57-65`, `ownProperty.ts`, `editAffordance.ts:511-543`, `runVocabulary.ts`, `library/libraryVocabulary.ts`, `library/librarySubtree.fences.test.ts`
- `frontend/src/pages/WorkflowRunPage.tsx`, `WorkflowBuilderPage.tsx:2106,2136,2656`
- `frontend/src/hooks/useTheme.ts`, `providers/TechnicalNamesProvider.tsx`
- `frontend/src/components/workflows/PhaseFormPanel.test.tsx:23,626-631,634-721`; `PhaseFormPanel.rails.test.tsx` (full structure)
- `backend/tests/test_188_workflow_run_read.py` (full)
- `scripts/vitest-count-gate.cjs` — `BASELINE` (96 entries) + `TARGETS` (55 entries)
- `.planning/sketches/200-journey-interactive/` — `index.html:117-228`, `README.md`, `FORWARD-CHECK.md`, `COVERAGE.md`, `PROMPTS.md`, `screens/*.html`
- `.planning/reported-bugs/BUG-260610-01, -260813-01, -260807-01, -260808-01, -260816-06`
- `.planning/seeds/SEED-171-*`, `SEED-148-*`
- `.planning/ROADMAP.md:83, 888-960`; `.planning/REQUIREMENTS.md:36,40`; `.planning/STATE.md`
- `CLAUDE.md`; `docs/HOT-FILE-LEDGER.md`; `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md`

### Command outputs (HIGH confidence — executed this session)
- `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` → `total 4970 · failed 0 · pinned total 4543` · `96/96` · exit 0
- `pytest tests/unit -q` → `62 failed, 2350 passed, 2 xfailed, 2 xpassed in 48.72s`
- `pytest tests/test_188_workflow_run_read.py tests/test_workflow_phase_cancel.py tests/test_l01_finish_run_terminal_guard.py tests/test_thread_workflow_endpoint.py tests/test_harness_engine.py tests/test_harness_resume.py -q` → `1 failed, 121 passed in 4.42s`
- the CLAUDE.md hot-file triple recipe over 13 files (§C11, §X-7, §X-8, §X-16)
- `ls supabase/migrations/ | sort -V | tail` → highest `120_…`
- tag-stripped text extraction of the four in-scope `screens/*.html`

### Secondary (MEDIUM)
- The five bug reports' own tails (self-reported fix status for 807/808 — corroborated by grepping the guards into current source, which raises it to HIGH)

### Tertiary (LOW / NOT MEASURED)
- Local Supabase `:54322` reachability (Open Question 5)
- Chrome MCP viability for the four G-4 rows (A8)

---

## Metadata

**Confidence breakdown**
- Wire slice (sites, migration, models, transports): **HIGH** — every line read at HEAD
- Phase-type count facts: **HIGH** for the seven return shapes; **MEDIUM** for the choice of noun (a product decision — A1)
- The `paused` / resume finding: **HIGH** — exhaustive grep over `backend/app`, plus the single call site of `find_resumable_runs`
- Frontend render targets and pins: **HIGH** — verbatim quotes, mounts grepped
- Sketch ledger transcription: **HIGH** — read directly from `index.html`
- CONTEXT corrections X-1…X-16: **HIGH** — each is a measurement against a quotation
- Risk sizing: **MEDIUM** — the evidence is measured; the effort estimate is judgement

**Research date:** 2026-08-19
**Valid until:** **2026-08-26 (7 days)** — this tree moves fast: the count-gate constant rotted twice in three days, four hot-file cells were stale when checked, and two bug-report line pointers drifted 54 and 67 lines. **Re-derive the gate figure, the hot-file triples and every `:NNN` before relying on them.**
