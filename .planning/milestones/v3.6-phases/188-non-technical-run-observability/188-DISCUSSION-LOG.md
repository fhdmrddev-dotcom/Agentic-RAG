# Phase 188: Non-Technical Run Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 188-non-technical-run-observability
**Mode:** `--auto` — operator delegated selection explicitly (*"discuss this phase autonomously and select the best choices"*). No `AskUserQuestion` was used; every row below records the option Claude selected and why, so the operator can audit and reverse any of them.
**Areas discussed:** Canvas↔stream join key · The shared module's boundary · The seven readings and their words · The run-state channel · The fail-open fix · The run surface's address and wiring · Reachability without a Runs list · The run-read endpoint · Elapsed honesty · Reported-bugs routing · SC#10 method

---

## 1. How the canvas joins live state to its nodes

| Option | Description | Selected |
|--------|-------------|----------|
| Join by `phase.slug` | The obvious key — node ids already are slugs (Phase 184) | |
| Join by `phase_index` | Positional join against the linear definition spine | ✓ |
| Join by slug with an index fallback | Belt and braces | |

**Choice:** join by `phase_index` (D-188-01).
**Notes:** Not a preference — a measured constraint. `reconcilePhases`' **live** branch seeds non-current rows with placeholder slugs `phase-${i}` (`StreamsProvider.tsx:3300-3324`), so a slug join silently fails to match every not-yet-started node mid-run, and inherits `BUG-260609-04` onto the canvas. The hybrid was rejected because a fallback hides the defect instead of making it impossible. Joining is not rendering — Req 2's grep is scoped to the render path.

---

## 2. What the shared phase-state module (Req 8) actually contains

| Option | Description | Selected |
|--------|-------------|----------|
| Derivation only; each view keeps its own words | One state function, two vocabularies | ✓ |
| Derivation + a single shared vocabulary | Both views print the same strings | |
| A shared presentational component | The canvas embeds a panel-derived atom | |

**Choice:** derivation only (D-188-02).
**Notes:** Option 2 contradicts the phase's own goal — Req 2 exists *because* the panel's words are harness words (`pending` renders "Locked"). Option 3 collides with the card's fixed budget. Req 8's acceptance is "zero local re-derivations", not "identical strings" — the two views are meant to say different things about the same fact.

---

## 3. The readings and their canvas words

| Option | Description | Selected |
|--------|-------------|----------|
| Six readings, unknown folded into "not started" | Matches SPEC Req 1's literal count | |
| Seven readings, unknown explicitly distinct | Matches SPEC Req 3 + sketch 153's seven cells | ✓ |

**Choice:** seven (D-188-04).
**Notes:** Req 3 requires unknown be *visually distinct from both done and not started*, so folding it into "not started" would violate the requirement that generated it. Recorded as a clarification of the SPEC's "all six" wording — the seal test must cover all seven, since unknown is precisely where a fail-open would hide.

Word selections: `pending` → **"Not started"** (not "Locked" — a harness word that reads as a *permission* beside the Phase-185 governance rail); waiting → **"Paused for your answer"** (differs from the shipped `Waits for you` badge in verb, object and aspect, satisfying Req 5's not-a-tense-change test); unknown → **"State unknown"**. `Running` / `Complete` / `Failed` / `Skipped` inherited verbatim from `STATUS_META`.

---

## 4. What carries run state on the card (sketch 153)

| Option | Description | Selected |
|--------|-------------|----------|
| **A** — the 62×62 icon well becomes a status ring; arc shape is the state | Spends no slot, uses no glyph | ✓ (operator, 2026-08-05) |
| **B** — the `stepNumber` slot's frame shape carries state | Fills a declared slot; grazes the verdict mark by a measured 2×16px | |
| **C** — a lane beneath the node carries state | Card untouched; state sits where the eye skips (144-B) | |

**Choice:** A — already locked by the operator at sketch time; recorded here for the audit trail.
**Notes:** A leaves badge slot 1, `stepNumber` and `technicalLine` all free for Phase 189, and introduces **zero net-new glyphs** (D-188-06) — under an icon convention that caught two glyph drifts in five days, a channel that cannot drift is worth something on its own. The two SVG build notes (no `overflow-hidden` in the subtree; `stroke-dashoffset` not rotation) carry into the plan verbatim (D-188-07).

---

## 5. Fixing the `?? "done"` fail-open

| Option | Description | Selected |
|--------|-------------|----------|
| Widen `Phase["status"]` with `"unknown"` | The compiler then forces the panel to be honest too | ✓ |
| Keep the union; derive unknown only on the canvas | Panel unchanged; but `reconcilePhases` still has to *store* something | |

**Choice:** widen (D-188-08).
**Notes:** Option 2 leaves the actual bug in place — the stored value would still be `done`. Widening makes `STATUS_META`'s `Record<Phase["status"], …>` a typecheck error until the panel states an honest unknown, which is the desired outcome. Adding a member is not "changing shipped wording", so it stays inside the SPEC's out-of-scope line. The test is observed RED against unmodified HEAD first, with raw output pasted into the plan summary (D-188-09) — Phase 187's `187-01` pattern.

---

## 6. Where the run surface lives, and how it is addressed

| Option | Description | Selected |
|--------|-------------|----------|
| A new `ActiveView` member, run id held in `ChatLayout` | ChatLayout already owns `doRun`, `onNavigate` and the panel | ✓ |
| A new top-level page rendered from `App.tsx` | Symmetrical with the other pages | |
| Introduce a router | Real URLs; a retained link becomes possible | |

**Choice:** `ActiveView` + `ChatLayout` state (D-188-10).
**Notes:** Option 3 breaks the three-homes no-router contract — a hard architectural rule, not a style preference. Option 1 over 2 because the launch path (`doRun`) and the run surface must share the resolved run id, and `doRun` lives in `ChatLayout`.

Addressing: keyed by `workflow_runs.id`, resolved in `doRun` via `getThreadWorkflow(thread.id).active_workflow_run_id` (D-188-11). ⚠ Recorded as a landmine: `PostMessageResponse.run_id` is the **producer `runs` row**, a different table — using it would produce a surface that resolves nothing.

---

## 7. Reaching a finished run without a Runs list

| Option | Description | Selected |
|--------|-------------|----------|
| Bidirectional seam — run ⇄ thread | Chat history is already one thread per run; costs nothing | ✓ |
| In-session only | Honest but leaves SPEC Req 7 barely reachable | |
| Build the Runs list anyway | Contradicts the SPEC's explicit deferral | |

**Choice:** bidirectional seam (D-188-13).
**Notes:** The SPEC recorded the deferral's consequence as *"reachable only from its workflow or a retained link"* — and with no router there are no links, so that sentence would have resolved to *not reachable*. `doRun` mints one thread per run, so chat history already **is** the run index. Req 6 says the thread "remains reachable from chat history and from the run surface"; making it reachable both ways closes the gap at zero cost. Option 3 was rejected outright as the exact scope creep G-7 was ratified to prevent.

---

## 8. The net-new read

| Option | Description | Selected |
|--------|-------------|----------|
| `GET /workflow-runs/{id}` in its own router, definition + phases inline | Disambiguates the two id types; one round trip | ✓ |
| `GET /runs/{id}` in `runs.py` as the SPEC spells it | Literal fidelity to the SPEC's wording | |

**Choice:** `GET /workflow-runs/{id}` (D-188-15).
**Notes:** A deviation from the SPEC's **path spelling**, not its scope — the SPEC locks *one net-new read of a run by id* and its acceptance criteria never name a URL. `/runs/{run_id}` already means the producer `runs` row across four shipped routes; mounting a differently-typed id on the same segment promotes the D-188-11 confusion to the wire. Flagged so the planner does not "correct" it back. The `definition` is returned **inline and version-accurate** because `listPublishedWorkflows` only ever returns the *current* published version — a run of an older version would otherwise be drawn against a definition it never executed.

Gating: `Depends(require_canvas())`. Noted rather than assumed: `CANVAS_GATED_PATHS` does **exact** path matching, so `/workflow-runs/<uuid>` can never match its request-side half; whether the OpenAPI-strip half needs the template key must be decided by reading what `test_revert_byte_identical` actually asserts (D-188-16).

---

## 9. Elapsed time honesty

| Option | Description | Selected |
|--------|-------------|----------|
| Show it, anchor named in words **and** under ⌥ | Satisfies "labelled with the field it derives from" twice over | ✓ |
| Show nothing | Also permitted by the SPEC; loses the live-run feel | |
| Show it unlabelled | | |

**Choice:** show it, doubly labelled (D-188-18).
**Notes:** `workflow_runs` has **no `started_at`/`completed_at`** — sketch 130-C's "anchor to `started_at`" is right in spirit and wrong in field here. Visible words: *"since it started processing"*; ⌥ reveal: the literal `claimed_at`. When `claimed_at` is null the run is queued and **no** figure is shown — it reads "Waiting to start". An unlabelled clock silently meaning *since queued* is a lie the moment a run waits.

---

## 10. Where a terminal reason is printed (sketch 154)

| Option | Description | Selected |
|--------|-------------|----------|
| **A** — every node states its own truth | Fact and location are one object | ✓ (operator, 2026-08-05) |
| **B** — one run-level notice, nodes stay quiet | One sentence about a five-step spine | |
| **C** — mark the node, the band explains | Splits the two halves across two places | |

**Choice:** A — locked by the operator at sketch time.
**Notes:** Same principle 145-A settled for the review moment: decision and evidence are one object. The cost is recorded now rather than discovered later (D-188-17) — A is the first thing to spend the card's free vertical space, now competing with the Phase-187 ⌥ subtitle and `technicalLine`. **Plan the card body as one budget, not three independent slots.**

Also recorded from 154: `cap_paused` gets a **word** ("Paused at the step limit") but no button — naming a state is run honesty, a Continue control is the control surface the SPEC excluded (D-188-19). And `TERMINAL_RUN_STATUSES`' `timed_out` is **not** deleted despite the sketch calling it dead (D-188-21): `frame.run_status` can be sourced from a Deep `runs` row, and removing it is a correctness claim this phase has not measured.

---

## 11. Reported-bugs routing (mandatory cross-check)

| Report | Area overlap | Routing |
|--------|--------------|---------|
| `BUG-260609-04` — phase-0 placeholder-slug clobber | `frontend/panel`, `harness/run-honesty` — genuine run-viz overlap; its own trigger names Phase 188 | **FOLDED** → 188 |
| `BUG-260609-02` — phantom generic "Sub-task" in Sub-Results | panel sub-agents; 188 touches neither `subAgents` nor the sub-results render | Reviewed, left **open** |
| `BUG-260718-02/-03/-04`, `BUG-260722-02`, `BUG-260730-02`, `BUG-260731-01` | chat surface / provider / harness-emit / judge | Not routing candidates — SEED-045 chat-polish track and the harness backlog, per the ROADMAP's reported-bugs mandate |

**Notes:** `BUG-260609-04` closes twice over (D-188-22): the canvas is immune **by construction** via the index join, and the panel is fixed at its root by overlaying `wf.phases`' real slugs onto the live skeleton by `phase_index` — the backend already returns them for the *active* anchor, so real slugs are available mid-run. 188 is already inside `reconcilePhases` for the fail-open fix, so this is one careful edit closing two things.

---

## 12. SC#10 method

| Option | Description | Selected |
|--------|-------------|----------|
| Per-request `model` + `provider` on `POST /threads/{id}/messages` | The non-mutating method proven in Phase 185 | ✓ *pending verification* |
| Eight published workflow variants | Certain to work; expensive | |
| Mutate the global setting per row | Contaminates the operator's environment | |

**Choice:** option 1, **explicitly conditional** (D-188-26).
**Notes:** A harness run takes its per-phase model from the **definition**, so it is *not established* that a per-request override reaches a workflow run's phases. This is exactly the class of inherited-unmeasured-claim that bit four of four executors in Phase 186, so it is written down as an open question the researcher must measure **before** the scoreboard is authored — not assumed and discovered at UAT. If it does not hold, the fallback is option 2 and its cost is stated rather than absorbed. Roster derived from `MODEL_CAPABILITIES`, never transcribed; a row may be ⛔ with a reason, never silently omitted.

---

## Claude's Discretion

Delegated wholesale by the operator for this session. Left explicitly open for the planner/executor: exact ring geometry and stroke values; the shared module's filename and directory; the run surface's component decomposition; the `WorkflowCanvas.tsx` diff cap number (proposal ≤ 25 ins / ≤ 5 del, to be confirmed achievable by the plan-checker before pinning); test file naming.

## Guardrail check

- **G-1** — not an insert phase; does not fire.
- **G-2** — satisfied 2026-08-05 by sketches 152/153/154 (`93bbfc87`).
- **G-3** — not applicable; this is not ≤ 1 file / ≤ 10 lines.
- **G-5** — **FIRES on `WorkflowCanvas.tsx`** (9 plans / 3 phases / 1,582 L). Surfaced before proceeding, per the orchestrator protocol. Honoured by scope: the phase performs the extraction the ledger's own 188 row names (the shared phase-state module) and caps the `WorkflowCanvas.tsx` diff as a pinned acceptance criterion — the same construction that honoured G-5 on `PhaseFormPanel.tsx` at Phase 185. The `PlaneEditingLayer` / `EDIT_AFFORDANCE` lift is **deferred, not closed**, and remains owed at the next `WorkflowCanvas` feature touch.
- **G-6** — satisfied: CONTEXT.md §H enumerates ten concrete observable failure conditions.
- **G-7** — no gap-closure rounds yet; not applicable.

## Deferred Ideas

`GET /runs` + the cross-workflow Runs home · a `cap_paused` Continue control · making `retrying` durable · the `PlaneEditingLayer` extraction · retiring `timed_out` · a `.docx`/PDF preview in `FilePreview` · `PhaseCard`'s stale `PHASE_TYPE_LABEL` glyph set · `elkjs` branching layout (→ Phase 191). Each carries a concrete re-open trigger in CONTEXT.md `<deferred>`.
