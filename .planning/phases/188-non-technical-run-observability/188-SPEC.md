# Phase 188: Non-Technical Run Observability — Specification

**Created:** 2026-08-05
**Ambiguity score:** 0.12 (gate: ≤ 0.20)
**Requirements:** 8 locked

## Goal

A non-technical user watching a published workflow run sees each step's live state on the canvas
in business language — painted from the same `usePhases(threadId)` slice the developer
`PhaseTimeline` reads, never disagreeing with it, and never showing a state a page refresh could
not restore — and stands on the run's own surface to do it, rather than being redirected into a
chat thread.

## Background

Grounded in the tree as of 2026-08-05. Every claim below was read, not inherited — four of four
executors in Phase 186 found an inherited claim false, and Phase 187's SPEC refuted two more.

**What already exists**

- The harness emits per-phase lifecycle events, and `StreamsProvider` already reduces them into a
  `phasesByThread` slice exposed as `usePhases(threadId)` (`StreamsProvider.tsx:3343`) with a
  reconcile-on-fetch floor (`usePanelReconcile`).
- `PhaseTimeline` / `PhaseCard` render that slice as the **developer** timeline in the workspace
  panel, and already carry a shipped, non-colour-alone status vocabulary: `STATUS_META`
  (`PhaseCard.tsx:67-79`) maps all six statuses to glyph + real text + an AA-contrast token.
- The canvas (`WorkflowCanvas` / `PhaseNode` / `PhaseNodeCard`) ships as an in-Builder projection
  with a 137-B card whose `status`, `stepNumber` and `technicalLine` slots are **declared and
  deliberately unrendered**, reserved for this phase (`PhaseNode.tsx:182-186`).
- A finished run's phase spine is **already** re-readable: `GET /threads/{id}/workflow` falls back
  to the latest `workflow_run` by `thread_id` when the anchor clears (`threads.py:1189-1197`).
- Workspace files are **thread-scoped** (`GET /threads/{id}/workspace/files`), and a run is 1:1
  with a thread — so a run's deliverable is reachable via `run.thread_id` with no new file
  endpoint.

**What does not exist, and what is wrong**

- **The canvas has no run state at all.** `NodeRunStatus` is `string` — deliberately opaque,
  owned by this phase.
- **Launching redirects into chat.** `doRun` ends `selectThread(thread); onNavigate("chat")`
  (`ChatLayout.tsx:264-266`). `WorkflowsPage` never owns a run route.
- **There is no run read endpoint.** `runs.py` exposes `/{run_id}/stream`,
  `/{run_id}/ask_user_response`, `/{run_id}/continue` and a `DELETE`. No `GET /runs/{id}`.
- **A fail-open with the wrong default.** `DB_PHASE_STATUS[r.status] ?? "done"`
  (`StreamsProvider.tsx:3337`) maps an unrecognised status to **success** — the exact reading SC#3
  forbids. Unreachable today because all five DB values are mapped; the same "unreachable" reasoning
  preceded the `findIndex → -1` fail-open that painted an unknown `blocked_stage` as 8/8 green.
- **`retrying` cannot survive a reload.** It exists in the client union (`types/index.ts:1013`) and
  NOT in `workflow_phases_status_check` (`pending｜active｜completed｜failed｜skipped`), so a
  reconcile can only return it as `running`.
- **`workflow_runs` has no `started_at` / `completed_at`** — only `created_at`, `updated_at`,
  `claimed_at` (`full-schema.sql:1947-1962`). Sketch 130-C's "anchor the timer to `started_at`"
  cannot be applied verbatim.
- **Vocabulary collides across the two views.** `⤳` is `STATUS_META.skipped` in the panel and the
  on-fail `skip_to_phase` **branch edge** on the canvas (`PhaseNode.tsx:257`). An
  `llm_human_input` step is "Needs you" in the panel (`PhaseCard.tsx:48`) and "Waits for you" on
  the canvas (`PhaseNode.tsx:177`) — and that canvas badge is a **design-time** fact, not a
  run-time state.

**Design input.** G-2 satisfied 2026-08-05 by sketches 152-154 (`93bbfc87`); winners **152-B**
(the run has its own room), **153-A** (the icon well becomes the status dial), **154-A** (every
node states its own truth).

## Requirements

1. **Per-node live run state on the canvas**: every node shows its live state, read from the same
   run stream the developer timeline reads.
   - Current: the canvas renders no run state; `NodeRunStatus` is an opaque `string` alias and the
     `status` slot is declared but never passed.
   - Target: each canvas node renders one of six readings — *not started · running · done · failed ·
     skipped · waiting-for-you* — derived from the same `usePhases(threadId)` slice `PhaseTimeline`
     consumes. No new Redis events, no new demux, no second reducer.
   - Acceptance: a parity test drives a fixture run through both views and asserts that, for every
     phase slug, the state rendered by the canvas and by `PhaseTimeline` resolve from the same
     source value and never disagree. A second assertion proves the governance seal renders
     identically at every run state (it may not become conditional on run state).

2. **Business vocabulary, not harness vocabulary**: the canvas states its readings in plain
   business language and exposes no harness identifiers.
   - Current: "distinct from the developer timeline" is prose in the ROADMAP with no testable
     meaning. The panel's own words are harness words — `pending` renders as **"Locked"**.
   - Target: the canvas renders no raw `slug`, `phase_index`, `phase_type` or DB status literal in
     its run-state surface; each reading uses business wording chosen for a non-technical reader,
     and `pending` is not called "Locked" on this surface. The ⌥ Technical-names reveal remains the
     only route to identifiers.
   - Acceptance: a source-scoped grep over the canvas run-state render path returns **zero**
     occurrences of the raw DB status literals and of `phase_index`; a render test at all six
     readings asserts no slug text appears with the reveal off.

3. **A total function over the full event set — no fail-open**: an unrecognised or absent state
   never reads as success.
   - Current: `DB_PHASE_STATUS[r.status] ?? "done"` (`StreamsProvider.tsx:3337`) falls back to
     **done**.
   - Target: the fallback resolves to an explicit *unknown* reading that is visually distinct from
     both *done* and *not started*; success is never inferred from the absence of an event, and a
     `gate_failed` / `run_failed` never renders as done.
   - Acceptance: a test feeds a status string absent from the map and asserts the canvas renders the
     unknown reading and **not** done — observed RED against the current `?? "done"` before the fix.

4. **The canvas paints only states a reconcile can restore**: nothing on the business canvas
   disappears or changes meaning on refresh.
   - Current: `retrying` is rendered live but has no DB representation, so a reconnect silently
     downgrades it to `running`.
   - Target: the canvas run view never paints `retrying`; a retrying phase reads as *running* on the
     canvas. The developer `PhaseTimeline` is unchanged and keeps showing `retrying` live. The view
     reconciles on fetch at every reconnect (Realtime is a hint, not truth — D-v2.5-03).
   - Acceptance: a test asserts the set of readings the canvas can render is a subset of those
     `reconcilePhases` can produce; a reconnect test drives a mid-run reconcile and asserts every
     visible node reading is identical before and after.

5. **The run-time waiting state has its own words**: "will pause" and "is paused right now" are
   never said the same way.
   - Current: `Waits for you` ships as a **design-time** badge on `llm_human_input` steps
     (`PhaseNode.tsx:174-180`), true whether or not anything has run. There is no run-time waiting
     state, and `Phase["status"]` has no member for one.
   - Target: the run-time waiting reading derives from `pendingAsk != null` and uses wording clearly
     distinct from the design-time badge — not a tense change. Both may be visible on the same node
     simultaneously and must read as two facts.
   - Acceptance: a render test puts a node in the run-time waiting state with the design-time badge
     present and asserts the two strings are not equal and do not differ only by verb tense; a grep
     asserts the run-time string is not the badge's literal.

6. **The run has its own surface**: launching a published workflow lands on the run, not in a chat
   message list.
   - Current: `doRun` creates a thread, posts the kickoff, then calls
     `selectThread(thread); onNavigate("chat")` (`ChatLayout.tsx:264-266`).
   - Target: launching lands the user on a run surface carrying the workflow's identity, its canvas
     run view, and its elapsed state — with **no message list and no composer**. The thread still
     exists, still holds the run (`threads.active_workflow_run_id`), remains reachable from chat
     history and from the run surface; it is simply not where launching puts you.
   - Acceptance: a test asserts the launch path does not navigate to the chat view and that the run
     surface renders neither a message list nor a composer; a second asserts the thread is still
     created and still anchors the run.

7. **A finished run re-opens**: a completed run is readable after it stops streaming, and its
   deliverable is reachable from it.
   - Current: no `GET /runs/{id}`. A finished run's spine is re-readable only thread-scoped, and
     since `doRun` mints a new thread per run, run history *is* chat history.
   - Target: a finished run can be re-opened by its id and renders its final per-node state and
     spine without streaming; its output files are reachable from that surface via the run's
     `thread_id` and the existing thread-scoped workspace-files read.
   - Acceptance: a test opens a terminal run with no live stream and asserts the spine and every
     node's final state render; a second asserts the deliverable is listed and downloadable from the
     run surface. Any elapsed figure shown is labelled with the field it is derived from.

8. **One phase-state derivation, two views**: the state logic `PhaseTimeline` and the canvas share
   lives in one module.
   - Current: phase-state derivation lives inside `PhaseTimeline.tsx` / `PhaseCard.tsx`; the canvas
     would be its second consumer. The G-5 ledger records the extraction as due in this phase.
   - Target: the derivation is extracted into a shared module consumed by both views, so the two
     cannot drift. `WorkflowCanvas.tsx` takes a **capped** pass-through change only — the
     `PlaneEditingLayer` / `EDIT_AFFORDANCE` lift named by `185-10` is NOT attempted here.
   - Acceptance: both views import the derivation from the shared module (grep: zero local
     re-derivations); `git diff --numstat` on `WorkflowCanvas.tsx` stays within a stated insertion
     cap recorded as a plan acceptance criterion, mirroring `187-08`'s ≤7/≤2 discipline.

## Boundaries

**In scope:**

- Per-node live run state on the canvas, in business language, from the existing `usePhases` slice
- The explicit *unknown* reading and the `?? "done"` fallback fix, with a falsification test
- Reconcile-on-fetch behaviour for the canvas run view; canvas restricted to restorable readings
- A distinct run-time waiting reading derived from `pendingAsk`
- A run surface that launching lands on — no message list, no composer
- `GET /runs/{id}` (single net-new read) and re-opening a finished run
- The deliverable reachable from the run, via `run.thread_id` + the existing thread-scoped files read
- Extraction of the shared phase-state module consumed by both views
- An 8-row SC#10 cross-provider scoreboard, scoped per Constraints below

**Out of scope:**

- **`GET /runs` and a cross-workflow Runs home** — deferred to its own phase. SC#5 and SC#6 ask
  that launching land on the run and that a finished run re-open; neither requires a list. Named
  consequence, recorded rather than discovered: without a list, a finished run is reachable only
  from its workflow or a retained link.
- **Any migration** — the ROADMAP flags this phase zero-migration, and Requirement 4 resolves
  `retrying` without one by refusing to paint it.
- **Making `retrying` durable** (a `workflow_phases` attempt column) — would break the
  zero-migration flag and widen scope into the harness engine.
- **The `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction from `WorkflowCanvas.tsx`** — it serves
  *editing*, which run-viz never touches, and lifting it risks the live ESM cycle
  (`WorkflowCanvas` imports `FlowEdge`'s value at module scope) for no run-viz payoff.
- **Changing the shipped `Waits for you` badge or the panel's `STATUS_META` wording** — Requirement
  5 gives the run-time state new words instead of re-cutting shipped Phase-183 vocabulary.
- **Re-homing or re-styling the developer `PhaseTimeline`** — it stays as it is; this phase adds a
  second view, it does not replace the first.
- **`elkjs` / branching layout for `llm_batch_agents` fan-out** — ROADMAP-deferred to Phase 191.
- **A second runtime, or a run that is not thread-backed** — D-14. The harness engine stays the only
  executor and the run stays anchored by `threads.active_workflow_run_id`.
- **A `cap_paused` control surface** — the missing vocabulary is noted (sketch 154) but resuming a
  capped run via `POST /runs/{id}/continue` is not built here.
- **The approval / review moment** — GOVERN-03 shipped in Phase 185; this phase renders the waiting
  *state*, not a new review surface.

## Constraints

- **D-14 red line**: the canvas is a projection, never a second source of truth and never a second
  runtime; every new route and surface is flag-gated behind `visual_workflow_canvas` at every layer;
  Deep Mode stays byte-identical.
- **One run stream, two views**: no new Redis events, no new demux, no second reducer over the
  phase stream.
- **Zero migrations.** Live head is 113.
- **No router.** A run surface extends the `ActiveView` union (`App.tsx:91`, currently 11 members);
  the three-homes contract's no-router rule holds.
- **Card budget is fixed.** A third badge is a typecheck error (`BadgeSlots` is a max-2 tuple); no
  focusable control may live inside the card (one tab stop per node); the governance seal owns
  top-right and may not be made conditional on run state.
- **`workflow_runs` has no `started_at`/`completed_at`.** Any elapsed figure is derived from
  `claimed_at`/`updated_at` and must be labelled as such, or not shown.
- **Icon convention**: run-state marks inherit `STATUS_META` where it can be inherited. `⤳` may NOT
  be reused for *skipped* on the canvas — it is already the on-fail branch edge. Any net-new mark is
  flagged as such.
- **SC#10 bar**: the full native roster (OpenAI, Anthropic, Google, DeepSeek, Zhipu/GLM, MiniMax,
  Moonshot/Kimi) plus OpenRouter = 8 rows, derived from `MODEL_CAPABILITIES` rather than
  transcribed. Each row asserts only what this phase changes — the run reaches a terminal state and
  the canvas paints each node correctly. A row may be recorded ⛔ with its reason and blocking issue
  id; it may never be silently omitted.

## Acceptance Criteria

- [ ] Canvas and `PhaseTimeline` resolve every phase's state from the same source value and never
      disagree, proven by a parity test over a fixture run
- [ ] The governance seal renders identically at all six canvas readings (unchanged by run state)
- [ ] A grep over the canvas run-state render path returns zero raw DB status literals and zero
      `phase_index`; no slug text renders with the ⌥ reveal off
- [ ] An unrecognised status renders the explicit unknown reading, NOT done — test observed RED
      against the current `?? "done"` before the fix
- [ ] The set of readings the canvas can render is a subset of those `reconcilePhases` can produce
      (i.e. the canvas never paints `retrying`)
- [ ] A mid-run reconcile leaves every visible node reading identical before and after
- [ ] The run-time waiting string is not equal to the `Waits for you` badge literal and does not
      differ from it only by verb tense
- [ ] Launching a published workflow does not navigate to the chat view; the run surface renders no
      message list and no composer
- [ ] Launching still creates the thread and still sets `threads.active_workflow_run_id`
- [ ] A terminal run re-opens by id with no live stream and renders its spine and final per-node state
- [ ] The deliverable is listed and downloadable from the run surface
- [ ] Any elapsed figure on the run surface is labelled with the field it derives from
- [ ] Both views import the phase-state derivation from one shared module (grep: zero local
      re-derivations)
- [ ] `WorkflowCanvas.tsx` diff stays within the insertion cap recorded as a plan acceptance criterion
- [ ] With `visual_workflow_canvas` off, the product is byte-identical to today
      (`test_revert_byte_identical` stays green)
- [ ] Zero migration files added
- [ ] SC#10 scoreboard: 8 rows present, each PASS or ⛔-with-reason; none silently omitted

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | "Distinct" replaced by a parity test + a no-jargon grep       |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | 10 explicit exclusions, each with a reason                    |
| Constraint Clarity | 0.86  | 0.65 | ✓      | D-14, zero-migration, card budget, no-router, SC#10 bar       |
| Acceptance Criteria| 0.86  | 0.70 | ✓      | 17 pass/fail criteria; the fail-open one must be observed RED |
| **Ambiguity**      | 0.12  | ≤0.20| ✓      |                                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                              | Decision locked                                                                 |
|-------|-----------------|-----------------------------------------------|---------------------------------------------------------------------------------|
| 1     | Researcher      | Does RUNVIZ-03 owe the Runs list too?         | **No** — run surface only (`GET /runs/{id}`); the cross-workflow list is its own phase |
| 1     | Researcher      | What happens to the chat thread?               | Stays, reachable, not shown at launch — D-14 keeps the run thread-backed         |
| 1     | Researcher      | Is the G-5 `WorkflowCanvas` extraction ours?   | Scoped: extract the shared phase-state module; cap the `WorkflowCanvas` diff; `PlaneEditingLayer` deferred |
| 2     | Simplifier      | What makes the view falsifiably "distinct"?    | Same facts + plain words + shape: a parity test plus a no-harness-vocabulary grep |
| 2     | Simplifier      | Which half survives a 50% cut?                 | Per-node run state (RUNVIZ-01/02) — the differentiator, and no net-new backend    |
| 2     | Researcher      | How to resolve `retrying` at zero migrations?  | The canvas never paints a state it cannot restore; the panel keeps it live        |
| 3     | Boundary Keeper | Is the `?? "done"` fail-open in scope?         | **Yes** — it IS SC#3's mechanism; one word plus a test observed RED first         |
| 3     | Boundary Keeper | What is the honest SC#10 bar here?             | 8 rows, assertion scoped to what this phase changes; ⛔ allowed, silent omission not |
| 3     | Boundary Keeper | What are the run-time waiting words?           | Distinct wording from the design-time badge — not a tense change                  |

---

*Phase: 188-non-technical-run-observability*
*Spec created: 2026-08-05*
*Design input: sketches 152-154 (`93bbfc87`) — winners 152-B, 153-A, 154-A*
*Next step: /gsd:discuss-phase 188 — implementation decisions (how to build what's specified above)*
