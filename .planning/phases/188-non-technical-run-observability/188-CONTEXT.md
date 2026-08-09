# Phase 188: Non-Technical Run Observability - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Mode:** `--auto` (operator delegated: *"discuss this phase autonomously and select the best choices then proceed to planning"*) — every decision below was auto-selected by the recommended option and is logged in `188-DISCUSSION-LOG.md` for audit.

<domain>
## Phase Boundary

A non-technical user watching a published workflow run sees each step's live state **on the canvas**, in business words, derived from the same `usePhases(threadId)` slice the developer `PhaseTimeline` reads — never disagreeing with it, never painting a state a reconcile cannot restore — and stands on **the run's own surface** to do it rather than being redirected into a chat thread. A finished run re-opens by id and its deliverable is reachable from it.

This phase clarifies **HOW** to build what `188-SPEC.md` locked. It adds no capability the SPEC did not scope.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `188-SPEC.md` for full requirements, boundaries, and acceptance criteria (ambiguity 0.12, gate ≤ 0.20).

Downstream agents MUST read `188-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Per-node live run state on the canvas, in business language, from the existing `usePhases` slice
- The explicit *unknown* reading and the `?? "done"` fallback fix, with a falsification test
- Reconcile-on-fetch behaviour for the canvas run view; canvas restricted to restorable readings
- A distinct run-time waiting reading derived from `pendingAsk`
- A run surface that launching lands on — no message list, no composer
- A single net-new run-read endpoint and re-opening a finished run
- The deliverable reachable from the run, via `run.thread_id` + the existing thread-scoped files read
- Extraction of the shared phase-state module consumed by both views
- An 8-row SC#10 cross-provider scoreboard, scoped per SPEC Constraints

**Out of scope (from SPEC.md):**
- **`GET /runs` and a cross-workflow Runs home** — deferred to its own phase (this is the single largest deviation from sketch 152-B; see D-05)
- **Any migration** — zero-migration flag; Req 4 resolves `retrying` by refusing to paint it
- **Making `retrying` durable** (a `workflow_phases` attempt column)
- **The `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction from `WorkflowCanvas.tsx`**
- **Changing the shipped `Waits for you` badge or the panel's `STATUS_META` wording**
- **Re-homing or re-styling the developer `PhaseTimeline`**
- **`elkjs` / branching layout for `llm_batch_agents` fan-out** — ROADMAP-deferred to Phase 191
- **A second runtime, or a run that is not thread-backed** (D-14)
- **A `cap_paused` control surface** (resuming via `POST /runs/{id}/continue`) — but see D-16: it gets a *word*, not a button
- **The approval / review moment** — GOVERN-03 shipped in Phase 185

</spec_lock>

<decisions>
## Implementation Decisions

### A. How the canvas gets run state (Req 1, 4, 8)

- **D-188-01 — The canvas joins live phase rows to definition nodes by `phase_index`, NEVER by `slug`.**
  Measured cause: `reconcilePhases` (`StreamsProvider.tsx:3300-3324`) seeds the **live** branch as a positional skeleton whose non-current rows carry placeholder slugs `phase-${i}`, and whose current row is `wf.current_phase_slug ?? "phase-${i}"`. A slug join would therefore fail to match every not-yet-started node during a live run — and would inherit `BUG-260609-04` onto the canvas.
  `workflow_phases.phase_index` is the harness's index into the same linear definition spine the canvas projects, so index is a sound and stable key. **Joining by index is not rendering it** — Req 2's grep is scoped to the *render* path, and this decision does not put `phase_index` on screen.

- **D-188-02 — The shared module (Req 8) holds the DERIVATION, not the VOCABULARY.**
  One new module (suggested `frontend/src/lib/phaseState.ts`; the planner may site it elsewhere, but it must be importable by both `components/panel/*` and `components/workflows/*` without an ESM cycle). It exports:
  - `DB_PHASE_STATUS` (moved out of `StreamsProvider.tsx`) and the **total** `phaseStatusFromDb(raw)` — no `?? "done"`.
  - the `CanvasReading` union and `canvasReading(phase)` — the collapse rule below.
  - `TERMINAL_RUN_STATUSES` (moved out of `PhaseTimeline.tsx:40`).
  Each view keeps its OWN presentation table: the panel keeps `STATUS_META` and its harness words (`"Locked"`, `"Attempt N"`) verbatim; the canvas owns a separate business-word table. **Two vocabularies are correct here; two derivations are not.** Acceptance for Req 8 = grep proves zero local re-derivations, not that the two views print the same strings.

- **D-188-03 — `retrying` collapses to *running* inside `canvasReading()`, in one named place.**
  The panel continues to read `phase.status === "retrying"` directly and is untouched. The Req 4 subset assertion then tests a property of one function rather than a scattering of call sites.

### B. The seven readings and their words (Req 1, 2, 5)

- **D-188-04 — The reading set is SEVEN, not six.** SPEC Req 1 names six normal readings; Req 3 mandates an explicit *unknown* that is visually distinct from both *done* and *not started*. Sketch 153 draws seven cells for this reason. The SPEC's acceptance line *"the governance seal renders identically at all six canvas readings"* means *every normal reading* — **the seal test must cover all seven**, since unknown is the one a fail-open would hide behind. Recorded as a clarification of the SPEC's wording, not a change to its intent.

| Reading | Source | Canvas word (LOCKED) | Why not the panel's word |
|---|---|---|---|
| not started | `status = "pending"` | **"Not started"** | `STATUS_META.pending` says **"Locked"** — a harness word for *the engine has not unlocked this step*, which beside a Phase-185 governance rail that also says *locked* reads as a permission |
| running | `status = "running"` (or `"retrying"`, collapsed) | **"Running"** | inherited verbatim |
| done | `status = "done"` | **"Complete"** | inherited verbatim |
| failed | `status = "failed"` | **"Failed"** | inherited verbatim; agrees with `VERDICT_MARK.error` |
| skipped | `status = "skipped"` | **"Skipped"** | word inherited; **the `⤳` glyph is NOT** — it is already the on-fail `skip_to_phase` branch edge (`PhaseNode.tsx:257`) |
| waiting for you | `pendingAsk != null` | **"Paused for your answer"** | net-new; see D-188-05 |
| unknown | any status absent from the map | **"State unknown"** | net-new; see D-188-06 |

- **D-188-05 — The run-time waiting words are "Paused for your answer".** Req 5 forbids a string equal to the shipped design-time badge `Waits for you` or differing from it only by verb tense. *Paused for your answer* differs in verb, object and aspect, and the two may legibly co-exist on one node — the badge says *this step will pause*, the ring says *it is paused right now*. It is also deliberately distinct from `PhaseCard`'s `llm_human_input` **type** label "Needs you" (`PhaseCard.tsx:48`), which is a phase-type label, not a run state.

- **D-188-06 — Phase 188 introduces ZERO net-new canvas glyphs.** Sketch 153's winner **A (the icon well becomes the status dial)** carries state as *arc geometry*, so the `‖` and `⋯` marks that variants B and C needed are never spent. Where a glyph is unavoidable it is **inherited, never invented**: `?` from `VERDICT_MARK.unknown` (`nodePresentation.ts:176`), `✕` / `✓` / `●` / `○` / `↻` from `STATUS_META` (`PhaseCard.tsx:67-79`). Every state must survive **colour switched off** — that is sketch 153's whole acceptance test and it is a build criterion, not a preference.

- **D-188-07 — Two SVG build notes from 153-A carry into the plan verbatim.**
  (1) The ring is a sibling of the icon wrapper, which already overflows the node box upward by 26px — **nothing in the node subtree or its wrapper may take `overflow-hidden`**.
  (2) Place the arc gaps with `stroke-dashoffset`, **never with a rotation** — setting the SVG `transform` attribute *and* CSS `transform-box`/`transform-origin` composes them and pivots about a doubled offset. That bug shipped in the sketch's first two drafts. The formula `offset = (D + G/2) − p` is in the sketch source.

### C. The fail-open fix (Req 3)

- **D-188-08 — `Phase["status"]` gains a `"unknown"` member, and that widening is the mechanism.**
  `?? "done"` (`StreamsProvider.tsx:3337`) becomes `?? "unknown"`. Because `STATUS_META` is typed `Record<Phase["status"], StatusMeta>`, the compiler then **forces** the developer panel to state an honest unknown too — which is the desired outcome, not collateral damage. The panel's new entry inherits `?` from `VERDICT_MARK.unknown` with the text `"Unknown"`. This is an **addition** to `STATUS_META`, not a change to shipped wording, so it does not cross the SPEC's out-of-scope line.

- **D-188-09 — The falsification test is observed RED before the fix, and the RED observation is recorded in the plan summary with raw output.** Phase 187's `187-01` is the pattern: write the test, run it against unmodified HEAD, paste the failure, then fix. A retro-fitted RED claim is not evidence.

### D. The run surface (Req 6, 7)

- **D-188-10 — `ActiveView` gains one member, `"workflow-run"`; the run id lives in `ChatLayout` state.**
  `App.tsx:91`'s union goes 11 → 12 members (one line). `ChatLayout` already owns `doRun`, `onNavigate` and the workspace panel, so it holds `activeRunId` and renders the surface. **No router** — the three-homes contract's rule holds (`references/app-information-architecture.md` #23-A); this is a fourth *home*, wired the same way as the other eleven.

- **D-188-11 — The run surface is addressed by the `workflow_runs.id`, and `doRun` resolves it via `getThreadWorkflow(thread.id).active_workflow_run_id`.**
  ⚠ **LANDMINE — two different ids share the name `run_id`.** `PostMessageResponse.run_id` (`api.ts:304`) is the **producer `runs` row** that `GET /runs/{id}/stream` consumes. `threads.active_workflow_run_id` is the **`workflow_runs` row**. They are different tables. Navigating with the wrong one yields a surface that resolves nothing. The researcher must confirm `active_workflow_run_id` is already set when `postMessage` resolves; if there is a race, the surface accepts a thread id and resolves the run itself.

- **D-188-12 — `doRun`'s `selectThread(thread); onNavigate("chat")` (`ChatLayout.tsx:264-265`) becomes `onNavigate("workflow-run")` with the resolved run id.** `createThread` + `postMessage` + the WR-04 cleanup path are untouched; `threads.active_workflow_run_id` is still set. Req 6's second assertion (the thread is still created and still anchors the run) is a guard against over-deleting here.

- **D-188-13 — The seam is BIDIRECTIONAL, and that is what makes a finished run reachable without a Runs list.**
  SPEC records the consequence of deferring `GET /runs` as *"a finished run is reachable only from its workflow or a retained link"* — and with no router there are no links. Resolution at zero cost: the run surface carries **"Open the chat thread"**, and the thread's existing run receipt carries **"Open the run"**. Chat history is already the index of runs (`doRun` mints one thread per run), so nothing new needs to be listed. This satisfies Req 6's *"remains reachable from chat history and from the run surface"* in both directions.

- **D-188-14 — One net-new read, returning everything the surface needs in one round trip.** Response shape:
  `{ id, thread_id, definition_id, definition, workflow_name, workflow_version, status, created_at, claimed_at, updated_at, phases: [{ slug, phase_index, status }] }`.
  The **`definition` is returned inline and is the version that actually ran** — `listPublishedWorkflows` only ever returns the *current* published version, so a run of an older version would otherwise be drawn against a definition it never executed. With `phases` inline, Req 7's terminal re-open renders spine + final per-node state with no stream and no second fetch.

- **D-188-15 — The endpoint is `GET /workflow-runs/{id}`, NOT `GET /runs/{id}`.**
  Deviation from the SPEC's *path spelling*, not its scope — the SPEC locks *one net-new read of a run by id*, and its acceptance criteria never name a URL. Reason: `/runs/{run_id}` already means the **producer `runs` row** in three shipped routes (`/stream`, `/ask_user_response`, `/continue`) plus a `DELETE`. Mounting a second, differently-typed id on the same segment is precisely the D-188-11 confusion promoted to the wire. A separate router also keeps the ownership check independent of the producer-run gates. **Planner: do not "correct" this back to `/runs/{id}`.**

- **D-188-16 — Gate it with `Depends(require_canvas())` (`dependencies.py:615`), the same posture as `POST /workflows/validate`.** Note the constraint the researcher must resolve rather than assume: `CANVAS_GATED_PATHS` (`middleware/canvas_gate.py:61`) is a frozenset of **exact** paths and its request-side half does exact-set membership on the *request* path, so `/workflow-runs/<uuid>` can never match it. `require_canvas` is therefore the authority. Whether the OpenAPI-strip half needs the *template* key `/workflow-runs/{workflow_run_id}` added must be decided by **reading what `test_revert_byte_identical` actually asserts**, not by assuming symmetry.

### E. Honesty on the run surface (Req 7, sketch 154-A)

- **D-188-17 — Winner 154-A: the reason lives on the step it belongs to.** Each terminal step states its own truth inside its card; the run band shrinks to one line. Same principle 145-A settled for the review moment — decision and evidence are one object.
  **The cost, recorded now rather than discovered later:** 154-A is the first thing to spend the card's free vertical space, and it now competes with the Phase-187 ⌥ subtitle and the still-notionally-free `technicalLine`. **Plan the card body as ONE budget, not three independent slots.**

- **D-188-18 — Elapsed is shown, and its anchor is named in plain words AND under the ⌥ reveal.**
  `workflow_runs` has **no `started_at` / `completed_at`** (`full-schema.sql:1947-1962`) — sketch 130-C's *"anchor the timer to `started_at`"* is right in spirit and **wrong in field** here. So: the figure derives from `claimed_at → updated_at`, the visible label reads **"since it started processing"**, and the ⌥ Technical-names reveal (shipped `TechnicalNamesProvider`, Phase 154) exposes the literal `claimed_at`. A test can assert both halves. **When `claimed_at` is null the run is queued and NO elapsed figure is shown** — it reads "Waiting to start". An unlabelled clock that silently means *since queued* is a lie the moment a run waits.

- **D-188-19 — `cap_paused` gets a WORD, never a button: "Paused at the step limit".**
  It is a shipped `workflow_runs.status` with a shipped continue route and **no vocabulary anywhere in the product** (sketch 154, finding 3). Naming a state the run is genuinely in is run honesty; a Continue control is the *control surface* the SPEC put out of scope. Read-only.

- **D-188-20 — The terminal loudness ladder is inherited from 129-C, not re-invented:** cancelled = dim, capped = amber, failed = red framed. `references/run-state-honesty.md` is the source.

- **D-188-21 — `TERMINAL_RUN_STATUSES`'s `timed_out` is NOT deleted.** Sketch 154 records it as dead because it is not a valid `workflow_runs.status`. But `PhaseTimeline` reads `frame.run_status`, which the thread-workflow frame can source from a **Deep `runs` row** as well. Removing it is a correctness claim this phase has not measured. **Carry it forward unchanged and note it**; a later phase may retire it with evidence. (Guard against the inherited-unmeasured-claim failure mode that bit four of four executors in Phase 186.)

### F. Reported bugs (mandatory cross-check)

- **D-188-22 — `BUG-260609-04` (phase-0 placeholder-slug clobber) is FOLDED into Phase 188.**
  Its own `re_open_trigger` names this phase: *"Re-check at Phase 188 … that is the phase that can actually close this."* `affected_areas: [frontend/panel, harness/run-honesty]` genuinely overlaps the run-viz surface, satisfying the ROADMAP's fold filter.
  **Two independent closures, both cheap:**
  (a) The canvas is immune **by construction** via D-188-01 — its labels come from the definition, never from a live slug.
  (b) The panel is fixed at the root: `reconcilePhases`'s **live** branch overlays the real slugs from `wf.phases` (which the backend already returns for the *active* anchor — `threads.py` resolves `phases_source_run_id = active_workflow_run_id` first, so real slugs ARE available mid-run) onto the positional skeleton by `phase_index`, keeping the `total_phases` floor for rows the harness has not inserted yet. This is fix option 1 from the bug report, and 188 is already inside `reconcilePhases` for D-188-08.
  Set `status: folded`, `folded_into: "188"` on the report.

- **D-188-23 — `BUG-260609-02` (phantom generic "Sub-task" in the Sub-Results panel) is reviewed and left OPEN.** It is the panel's sub-agent section; 188 touches neither `subAgents` nor the sub-results render. Its `re_open_trigger` is updated to record the 188 review.

- All other open `surface: Agentic-RAG` reports are chat-surface / provider / harness-emit items belonging to the SEED-045 chat-polish track or the harness backlog. Per the ROADMAP's reported-bugs mandate they are **not** routing candidates for this phase.

### G. Cross-provider SC#10 (8 rows)

- **D-188-24 — Derive the roster from `MODEL_CAPABILITIES`, never transcribe it.** Group by `provider`, take the newest **registry-backed** id per group (an id absent from the registry resolves `capability_source=inferred` and silently loses `emit_tier`, so the row would measure a weaker configuration than the one that ships). Eight rows: the native seven plus OpenRouter.
- **D-188-25 — Each row asserts only what this phase changes:** the run reaches a terminal state, and the canvas paints each node's reading correctly at that terminal state. Not emit quality, not citation behaviour.
- **D-188-26 — ⚠ Open question the researcher must answer before the scoreboard is authored:** a *harness* run takes its per-phase model from the **definition**, so it is not established that the per-request `model` + `provider` on `POST /threads/{id}/messages` — the cheap non-mutating method proven in Phase 185 — actually reaches a workflow run's phases. **Measure this first.** If it does not, the honest fallback is eight published workflow variants or a per-phase model override, and the cost must be stated rather than absorbed. A row may be recorded ⛔ with its reason and blocking id; it may **never** be silently omitted.

### H. How we'd know this failed (G-6)

Concrete observable conditions, so the phase can be judged rather than declared:

1. The canvas and the panel disagree about any phase's state at any moment during one run.
2. A step that never ran shows a completed ring — the fail-open, drawn as sketch 154's `☠ Today` scenario.
3. A refresh mid-run changes what any node says (the `retrying` loss, or a slug clobber relabelling a node).
4. A node whose step is waiting on the user is indistinguishable from a node whose step merely *will* wait.
5. Launching still lands in the chat message list, or the run surface grows a composer.
6. A finished run cannot be re-opened, or its `.docx` deliverable is not reachable from it.
7. An elapsed number is shown with no stated anchor — the "since queued" lie.
8. `visual_workflow_canvas` off is no longer byte-identical (`test_revert_byte_identical` red).
9. `WorkflowCanvas.tsx` exceeds its stated insertion cap, i.e. G-5 was talked about and not honoured.
10. Any migration file appears.

### Claude's Discretion

Auto-selected under `--auto`; the operator delegated selection explicitly. The following remain the planner's/executor's to size, and are *not* locked here: the exact ring geometry and stroke values; the shared module's filename and directory; the run surface's component decomposition; the precise `git diff --numstat` cap number (a starting proposal of **≤ 25 insertions / ≤ 5 deletions** on `WorkflowCanvas.tsx` is offered — the plan-checker should confirm it is achievable before it is pinned); test file naming.

### Folded Todos

- **SPIKE — NL→workflow authoring** (`spike-nl-workflow-authoring.md`, score 0.60) — **NOT folded.** The match is keyword-only (`grounded`, `run`, `2026`, `pending`); the spike is about authoring, which Phase 187 shipped. Recorded under Deferred.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements — read FIRST
- `.planning/phases/188-non-technical-run-observability/188-SPEC.md` — **Locked requirements — MUST read before planning.** 8 requirements, 10 explicit exclusions, 17 acceptance criteria, ambiguity 0.12.
- `.planning/ROADMAP.md` §"Phase 188: Non-Technical Run Observability" (line 469) — the 7 success criteria and the RUNVIZ-03 operator call of 2026-07-31.

### Design input (G-2 satisfied 2026-08-05, `93bbfc87`)
- `.planning/sketches/152-the-runs-own-room/README.md` — winner **B**. The run's own room; the four moments; **the two-net-new-reads bill, of which SPEC keeps only one**.
- `.planning/sketches/153-run-state-without-colour/README.md` — winner **A**. The icon well becomes the status dial; the **card occupancy audit**; the `Waits for you` collision; the `⤳` collision; the `STATUS_META` inheritance table; the two SVG build notes.
- `.planning/sketches/154-the-run-that-tells-the-truth/README.md` — winner **A**. Every node states its own truth; the four honesty decisions the sketch forces regardless of variant.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — load before touching any canvas / run surface. Then specifically:
  - `references/canvas-frame-and-node-anatomy.md` — 137-B geometry (260×104 / 248px card / radius 22 / mark 62×62 at `top:-26px` / seal `top 11 right 17` / verdict `-left-2 top-1.5`); the max-2 badge tuple; **no focusable control inside the card**; `overflow-hidden` prohibition.
  - `references/graded-governance.md` — the corner seal is load-bearing and **may never be conditional on run state** (SPEC Req 1's second assertion).
  - `references/run-state-honesty.md` — the 129-C tiered terminal vocabulary (D-188-20) and the anchored-timer rule (amended by D-188-18).
  - `references/approval-and-review.md` — the dedicated-run-surface proposal 146-A handed to this phase; the **DOCX/PPTX/XLSX/PDF are download-only** preview matrix, which is why the flagship `.docx` deliverable is reachable but not previewable.
  - `references/app-information-architecture.md` — the three-homes **no-router** contract this phase extends by one member.
  - `references/icon-convention.md` §4 — the canvas glyph vocabulary. Read before drawing any mark (D-188-06).
  - `references/harness-phase-timeline.md` — the developer view this canvas is the business twin of.

### Project rules that bind this phase
- `CLAUDE.md` §"Workflow guardrails" — G-2 (satisfied), **G-5 (fires — see code_context)**, G-6 (satisfied by §H above), G-7.
- `CLAUDE.md` §"UAT scoreboard recipe" — the full native roster rule behind D-188-24/25/26.
- `.planning/reported-bugs/BUG-260609-04.md` — folded (D-188-22); its own fix options 1 and 2 are the panel-side remedy.
- `.planning/reported-bugs/BUG-260609-02.md` — reviewed, left open (D-188-23).

### Code that must be read before planning
- `frontend/src/providers/StreamsProvider.tsx:3292-3365` — `DB_PHASE_STATUS`, `reconcilePhases` (both branches), `usePhases`, the `usePanelReconcile` floor.
- `frontend/src/components/panel/PhaseCard.tsx:67-79` — `STATUS_META`, the shipped six-status non-colour-alone vocabulary.
- `frontend/src/components/panel/PhaseTimeline.tsx:40,77-129` — `TERMINAL_RUN_STATUSES`, the `usePhases` consumer.
- `frontend/src/components/workflows/PhaseNode.tsx:174-186,257` — the `Waits for you` badge, the declared-unrendered `status`/`stepNumber`/`technicalLine` slots, the `⤳` branch edge.
- `frontend/src/components/workflows/PhaseNodeCard.tsx:440` — the `⛨` seal.
- `frontend/src/components/workflows/nodePresentation.ts:176` — `VERDICT_MARK`.
- `frontend/src/components/layout/ChatLayout.tsx:233-266` — `doRun`, incl. the WR-04 orphan cleanup that must survive.
- `frontend/src/App.tsx:91` — the `ActiveView` union.
- `frontend/src/lib/api.ts:1250-1305` — `ThreadWorkflowState`, `WorkflowPhaseState`, `PublishedWorkflow`; and `:302-312` `PostMessageResponse` (the D-188-11 id trap).
- `backend/app/api/threads.py:1179-1210` — the durable per-phase array read and its anchor-then-latest resolution.
- `backend/app/api/runs.py` — the four shipped producer-run routes (`/stream`, `/ask_user_response`, `/continue`, `DELETE`).
- `backend/app/dependencies.py:615-700` — `require_canvas()` + the WR-08 `canvas_caller` hand-off.
- `backend/app/middleware/canvas_gate.py:60-137` — `CANVAS_GATED_PATHS` and its exact-match semantics (D-188-16).
- `supabase/full-schema.sql:1932,1947-1962` — `workflow_phases_status_check`, and `workflow_runs`' columns (**no `started_at`/`completed_at`**) + its status enum incl. `cap_paused`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets — this phase is mostly composition, not construction
- **`usePhases(threadId)`** already reduces the harness phase stream and already reconciles on fetch via `usePanelReconcile`. Req 1, 2 and 4 are consumers of it; no new Redis events, no new demux, no second reducer.
- **`GET /threads/{id}/workflow`** already returns the durable per-phase array *and* resolves it from the latest `workflow_run` when the anchor has cleared (`threads.py`). A finished run's spine is therefore **already** re-readable — Req 7 mostly needs an address, not a new read.
- **`GET /threads/{id}/workspace/files`** is thread-scoped, and a run is 1:1 with a thread, so the deliverable is reachable via `run.thread_id` with **no new file endpoint**. This is the cheapest win in the phase.
- **`STATUS_META`** ships all six statuses with glyph + real text + AA-contrast token — five of six words and every needed mark are inheritable.
- **`require_canvas()`** is the shipped 404-when-off dependency, with the identity hand-off already solved (WR-08).
- **`TechnicalNamesProvider`** (Phase 154, already wired to the canvas toolbar) is the ⌥ reveal D-188-18 uses for the elapsed anchor.
- **`zundo`, `canvasNudge`, `canvasModel`** are authoring-side and are **not** touched by run-viz.

### Established Patterns
- **Realtime is a hint, not truth (D-v2.5-03)** — every view reconciles on fetch at reconnect.
- **Fail CLOSED on an unrecognised state.** The canvas gate fails closed deliberately; the publish gauntlet's `findIndex → -1` fail-open (an unknown `blocked_stage` painted 8/8 green) is the cautionary precedent that `?? "done"` repeats. D-188-08 is the same lesson, third occurrence.
- **Observe the falsification RED first** (Phase 185's SECURED lesson; Phase 187's `187-01`).
- **A capped diff is a real acceptance criterion**, measured with `git diff --numstat` — `187-08`'s ≤7/≤2 is the precedent.
- **Additive-only type changes** — `PhaseSpec.name_seeded_by_ai` (187-02) is the pattern for widening a shared type without a migration.

### Integration Points
- `StreamsProvider.reconcilePhases` — the `?? "done"` fix (D-188-08) **and** the real-slug overlay (D-188-22b) land in the same function. One careful edit, two closures.
- `ChatLayout` — `doRun`'s tail (D-188-12) plus the new `activeRunId` state and the run-surface render.
- `App.tsx` — one line, the `ActiveView` union.
- `WorkflowCanvas` — a **capped** pass-through of run state to `PhaseNode`. ⚠ **The live ESM cycle constraint holds:** `WorkflowCanvas` imports `FlowEdge`'s VALUE at module scope for the `edgeTypes` map, so any extracted module must not import back into it.
- A new backend router for `GET /workflow-runs/{id}`.

### ⚠ G-5 — FIRES on `WorkflowCanvas.tsx`, and is honoured by SCOPE, not by silence
The hot-file ledger records `WorkflowCanvas.tsx` at **9 plans across 3 phases, 1,582 lines — extraction due in Phase 188**, with `185-10` naming the seam (lift `PlaneEditingLayer` + `EDIT_AFFORDANCE`).

**Surfaced per the orchestrator protocol, and resolved as follows:** the SPEC (Req 8 + Boundaries) already ruled on this before discuss-phase — the extraction this phase performs is the **shared phase-state module**, which is the extraction the *milestone's own G-5 note* asked for (`ROADMAP.md:556`: *"`PhaseTimeline.tsx`/`PhaseCard.tsx` (188 `CanvasRunView` reuses their phase-state derivation → extract a shared phase-state module)"*). The `PlaneEditingLayer` lift is deliberately **not** attempted: it serves *editing*, which run-viz never touches, and lifting it risks the live ESM cycle for zero run-viz payoff.

So G-5 is honoured by **(a)** performing the extraction the ledger's own 188 row names, and **(b)** capping `WorkflowCanvas.tsx`'s diff as a pinned plan acceptance criterion — the same construction that honoured G-5 on `PhaseFormPanel.tsx` at Phase 185 (measured 23 ins / 6 del, of which only 4 insertions reached the render body). **The `PlaneEditingLayer` extraction remains OWED and must be re-stated in the ledger as due at the next `WorkflowCanvas` feature touch** — deferring it is a decision, not a closure.

</code_context>

<specifics>
## Specific Ideas

- **Sketch 152-B's bill was two net-new reads; the SPEC pays for one.** The deliverable is genuinely cheaper than the sketch implies, because the SPEC deferred `GET /runs` and the cross-workflow Runs home. Anyone reading 152-B without the SPEC will over-build. D-188-13's bidirectional seam is what replaces the list.
- **The `🕐 Tomorrow` moment is the acceptance feel** for the run surface: a day later, can the user find the run and get the file it made? Under this phase's scope the honest answer is *via the chat thread* — and that answer must be legible on screen, not implied.
- **"Colour off" is the acceptance test for run state**, exactly as sketch 143 set it for governance. Not a preference — a build criterion.
- **`.docx` cannot be previewed.** `FilePreview` routes DOCX/PPTX/XLSX/PDF to download-only, and `render_template` produces `.docx`. The flagship deliverable is the one artefact a reviewer cannot see. Req 7 asks it be *listed and downloadable*, which is achievable; do not promise a preview. (The viewer is its own insert phase — SPEC 185 precedent.)
- The canvas is a **projection of a LINEAR spine**, not a free DAG — linear `i→i+1` plus one dashed `skip_to_phase`. Run-viz does not change that.

</specifics>

<deferred>
## Deferred Ideas

- **`GET /runs` + a cross-workflow Runs home** — deferred by the SPEC to its own phase. Re-open trigger: the first time a user asks *"what ran last night?"* across workflows, or when a second surface needs to enumerate runs. Sketch 152-B's `Runs` home is the drawn design; it needs one new read and one more `ActiveView` member.
- **A `cap_paused` Continue control** — the word ships here (D-188-19), the button does not. Re-open trigger: a capped run is observed in the wild and the operator has no way to resume it from the run surface. `POST /runs/{id}/continue` is already a real route.
- **Making `retrying` durable** (a `workflow_phases` attempt column) — would break the zero-migration flag and widen into the harness engine. Re-open trigger: retry behaviour becomes something a *business* user must see, not just a developer.
- **The `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction from `WorkflowCanvas.tsx`** — G-5 debt, explicitly still owed (see code_context). Re-open trigger: the next feature touch on `WorkflowCanvas.tsx`.
- **Retiring `timed_out` from `TERMINAL_RUN_STATUSES`** (D-188-21) — needs measurement of whether a Deep `runs` row can surface it through `frame.run_status`. Re-open trigger: someone measures it.
- **A `.docx` / PDF preview in `FilePreview`** — its own insert phase, per the Phase 185 decision. Re-open trigger: unconditional at Phase 190 per `references/approval-and-review.md`.
- **`PhaseCard`'s stale `PHASE_TYPE_LABEL`** — it still carries the flat `⚙ ✎ 🤖 ⛓ ☺` glyphs Phase 127 retired in favour of the shared 3D `PHASE_GLYPHS` map, and lists only five types, so `llm_emit` falls through to `•` "Step" (noted while auditing in sketch 153). **Not 188's** — it is developer-panel vocabulary, and the SPEC puts panel wording out of scope. Re-open trigger: the next phase that touches `PhaseCard`'s presentation.
- **`elkjs` / branching layout for `llm_batch_agents` fan-out** — ROADMAP-deferred to Phase 191, conditional on real scale.

### Reviewed Todos (not folded)

- **SPIKE — NL→workflow authoring** (`.planning/todos/spike-nl-workflow-authoring.md`) — matched at 0.60 on keywords only (`grounded`, `run`, `2026`, `pending`). Its subject is authoring, which Phase 187 shipped; it has no run-observability content. Left pending.

</deferred>

---

*Phase: 188-non-technical-run-observability*
*Context gathered: 2026-08-05*
