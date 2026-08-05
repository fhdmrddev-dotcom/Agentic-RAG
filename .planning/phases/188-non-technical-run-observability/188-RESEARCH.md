# Phase 188: Non-Technical Run Observability — Research

**Researched:** 2026-08-05
**Measured against:** `db086240` (HEAD of `develop` at research time)
**Domain:** React run-state projection over an existing SSE/reconcile slice + one net-new FastAPI read
**Confidence:** HIGH (every load-bearing claim below was executed or read at HEAD, not inherited)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `188-CONTEXT.md § Implementation Decisions`. **The planner may not re-litigate
any of these.** Where this research CORRECTS a factual premise inside a decision, the correction is
called out inline and the decision itself still stands unless the correction makes it impossible.

**A. How the canvas gets run state (Req 1, 4, 8)**

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

**B. The seven readings and their words (Req 1, 2, 5)**

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

**C. The fail-open fix (Req 3)**

- **D-188-08 — `Phase["status"]` gains a `"unknown"` member, and that widening is the mechanism.**
  `?? "done"` (`StreamsProvider.tsx:3337`) becomes `?? "unknown"`. Because `STATUS_META` is typed `Record<Phase["status"], StatusMeta>`, the compiler then **forces** the developer panel to state an honest unknown too — which is the desired outcome, not collateral damage. The panel's new entry inherits `?` from `VERDICT_MARK.unknown` with the text `"Unknown"`. This is an **addition** to `STATUS_META`, not a change to shipped wording, so it does not cross the SPEC's out-of-scope line.

- **D-188-09 — The falsification test is observed RED before the fix, and the RED observation is recorded in the plan summary with raw output.** Phase 187's `187-01` is the pattern: write the test, run it against unmodified HEAD, paste the failure, then fix. A retro-fitted RED claim is not evidence.

**D. The run surface (Req 6, 7)**

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

**E. Honesty on the run surface (Req 7, sketch 154-A)**

- **D-188-17 — Winner 154-A: the reason lives on the step it belongs to.** Each terminal step states its own truth inside its card; the run band shrinks to one line. Same principle 145-A settled for the review moment — decision and evidence are one object.
  **The cost, recorded now rather than discovered later:** 154-A is the first thing to spend the card's free vertical space, and it now competes with the Phase-187 ⌥ subtitle and the still-notionally-free `technicalLine`. **Plan the card body as ONE budget, not three independent slots.**

- **D-188-18 — Elapsed is shown, and its anchor is named in plain words AND under the ⌥ reveal.**
  `workflow_runs` has **no `started_at` / `completed_at`** (`full-schema.sql:1947-1962`) — sketch 130-C's *"anchor the timer to `started_at`"* is right in spirit and **wrong in field** here. So: the figure derives from `claimed_at → updated_at`, the visible label reads **"since it started processing"**, and the ⌥ Technical-names reveal (shipped `TechnicalNamesProvider`, Phase 154) exposes the literal `claimed_at`. A test can assert both halves. **When `claimed_at` is null the run is queued and NO elapsed figure is shown** — it reads "Waiting to start". An unlabelled clock that silently means *since queued* is a lie the moment a run waits.

- **D-188-19 — `cap_paused` gets a WORD, never a button: "Paused at the step limit".**
  It is a shipped `workflow_runs.status` with a shipped continue route and **no vocabulary anywhere in the product** (sketch 154, finding 3). Naming a state the run is genuinely in is run honesty; a Continue control is the *control surface* the SPEC put out of scope. Read-only.

- **D-188-20 — The terminal loudness ladder is inherited from 129-C, not re-invented:** cancelled = dim, capped = amber, failed = red framed. `references/run-state-honesty.md` is the source.

- **D-188-21 — `TERMINAL_RUN_STATUSES`'s `timed_out` is NOT deleted.** Sketch 154 records it as dead because it is not a valid `workflow_runs.status`. But `PhaseTimeline` reads `frame.run_status`, which the thread-workflow frame can source from a **Deep `runs` row** as well. Removing it is a correctness claim this phase has not measured. **Carry it forward unchanged and note it**; a later phase may retire it with evidence. (Guard against the inherited-unmeasured-claim failure mode that bit four of four executors in Phase 186.)

**F. Reported bugs (mandatory cross-check)**

- **D-188-22 — `BUG-260609-04` (phase-0 placeholder-slug clobber) is FOLDED into Phase 188.**
  Its own `re_open_trigger` names this phase. **Two independent closures, both cheap:**
  (a) The canvas is immune **by construction** via D-188-01 — its labels come from the definition, never from a live slug.
  (b) The panel is fixed at the root: `reconcilePhases`'s **live** branch overlays the real slugs from `wf.phases` onto the positional skeleton by `phase_index`, keeping the `total_phases` floor for rows the harness has not inserted yet. This is fix option 1 from the bug report, and 188 is already inside `reconcilePhases` for D-188-08.
  Set `status: folded`, `folded_into: "188"` on the report.

- **D-188-23 — `BUG-260609-02` (phantom generic "Sub-task" in the Sub-Results panel) is reviewed and left OPEN.** 188 touches neither `subAgents` nor the sub-results render.

- All other open `surface: Agentic-RAG` reports are chat-surface / provider / harness-emit items belonging to the SEED-045 chat-polish track or the harness backlog — **not** routing candidates for this phase.

**G. Cross-provider SC#10 (8 rows)**

- **D-188-24 — Derive the roster from `MODEL_CAPABILITIES`, never transcribe it.** Group by `provider`, take the newest **registry-backed** id per group. Eight rows: the native seven plus OpenRouter.
- **D-188-25 — Each row asserts only what this phase changes:** the run reaches a terminal state, and the canvas paints each node's reading correctly at that terminal state. Not emit quality, not citation behaviour.
- **D-188-26 — ⚠ Open question the researcher must answer before the scoreboard is authored:** it is not established that the per-request `model` + `provider` on `POST /threads/{id}/messages` actually reaches a workflow run's phases. **Measure this first.** If it does not, the honest fallback is eight published workflow variants or a per-phase model override, and the cost must be stated rather than absorbed. A row may be recorded ⛔ with its reason and blocking id; it may **never** be silently omitted.

**H. How we'd know this failed (G-6)** — 10 concrete observable conditions, reproduced in
`188-CONTEXT.md § H`. They are the phase's failure criteria and the Validation Architecture below maps
to them one-for-one.

### Claude's Discretion

> Auto-selected under `--auto`; the operator delegated selection explicitly. The following remain the
> planner's/executor's to size, and are *not* locked here: the exact ring geometry and stroke values;
> the shared module's filename and directory; the run surface's component decomposition; the precise
> `git diff --numstat` cap number (a starting proposal of **≤ 25 insertions / ≤ 5 deletions** on
> `WorkflowCanvas.tsx` is offered — the plan-checker should confirm it is achievable before it is
> pinned); test file naming.

**This research supplies the two numbers discretion asked for** — see Open Question 6 (module siting)
and Open Question 7 (the defensible cap).

### Deferred Ideas (OUT OF SCOPE)

- **`GET /runs` + a cross-workflow Runs home** — deferred by the SPEC to its own phase. Re-open trigger: the first time a user asks *"what ran last night?"* across workflows, or when a second surface needs to enumerate runs.
- **A `cap_paused` Continue control** — the word ships here (D-188-19), the button does not. Re-open trigger: a capped run is observed in the wild and the operator has no way to resume it from the run surface.
- **Making `retrying` durable** (a `workflow_phases` attempt column) — would break the zero-migration flag. Re-open trigger: retry behaviour becomes something a *business* user must see.
- **The `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction from `WorkflowCanvas.tsx`** — G-5 debt, explicitly still owed. Re-open trigger: the next feature touch on `WorkflowCanvas.tsx`.
- **Retiring `timed_out` from `TERMINAL_RUN_STATUSES`** (D-188-21) — needs measurement. **⚠ This research MEASURED it — see Open Question 5. The deferral may now be closed with evidence, at the planner's discretion.**
- **A `.docx` / PDF preview in `FilePreview`** — its own insert phase. Re-open trigger: unconditional at Phase 190.
- **`PhaseCard`'s stale `PHASE_TYPE_LABEL`** — developer-panel vocabulary, out of scope.
- **`elkjs` / branching layout for `llm_batch_agents` fan-out** — ROADMAP-deferred to Phase 191.
- **SPIKE — NL→workflow authoring** (`.planning/todos/spike-nl-workflow-authoring.md`) — matched on keywords only; left pending, NOT folded.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **RUNVIZ-01** | A non-technical user can watch a workflow run on the canvas — each node shows live state (pending / active / passed / failed / skipped / waiting-for-you) painted from the same `usePhases(threadId)` run stream the developer `PhaseTimeline` uses (one run stream, two views; no new Redis events, no new demux). | § *Architecture Patterns → Pattern 1 (the projection seam)* + § *Pattern 2 (the index join)*. The slice, its reducer and its reconcile floor are all shipped and measured; the canvas pass-through costs ~11 insertions in `WorkflowCanvas.tsx` (§ *Open Question 7*). `PhaseNodeCard` already declares the `status` slot (`PhaseNodeCard.tsx:204`, `NodeRunStatus = string`) and already renders `technicalLine` (`:325`) — the seam is real, not aspirational. |
| **RUNVIZ-02** | The canvas run view is honest — node state is a total function over the FULL event set (never shows "done" on a `gate_failed` / `run_failed`) and reconciles-on-fetch at every reconnect (Realtime is a hint, not truth — D-v2.5-03). | § *Pitfall 1* (the REACHABLE fail-open the SPEC did not name — `finalizeAllPhasesForThread` sweeps `pending` → `done`), § *Pitfall 2* (`?? "done"`), § *Pitfall 3* (**there is no reconnect-driven reconcile today** — measured), § *Code Example 2* (the total function). |
| **RUNVIZ-03** | A workflow run and its finished deliverable have their own home — launching stops redirecting into Chat, a run stays retrievable after the fact, and the artefact is reachable from the run. | § *Pattern 3 (the fourth home)* incl. the measured positional-fallback trap at `ChatLayout.tsx:645`; § *Pattern 4 (the one net-new read)*; § *Open Question 9* (the deliverable is reachable with **zero** net-new file wire — `useWorkspaceFiles(run.thread_id)` + `downloadWorkspaceFile`, both already thread-parameterised). |

</phase_requirements>

---

## Summary

This phase is **composition over construction**, and the measurement confirms it more strongly than the
SPEC claimed. Every input the canvas needs already exists and is already correct: `usePhases(threadId)`
reduces the harness phase stream; `GET /threads/{id}/workflow` returns the durable per-phase array —
**with real slugs and real `phase_type`, for a LIVE run as well as a finished one** (`threads.py:1191-1235`,
measured); `PhaseNodeCard` already declares the `status` slot and already renders `technicalLine`; the
workspace-files read and the download helper are already thread-parameterised, so the deliverable needs
no new endpoint. The one genuinely net-new wire is a single ownership-gated `GET /workflow-runs/{id}`.

**Three findings change the shape of the plan, and all three are corrections to premises the SPEC and
CONTEXT built on.**

1. **There is a SECOND fail-open, and unlike `?? "done"` it is REACHABLE today.** On a successful
   `run_completed`, `finalizeAllPhasesForThread` (`StreamsProvider.tsx:2811-2826`) sweeps every phase in
   `running | retrying | **pending**` to `done`. A `skip_to_phase` jump marks only the *current* phase
   `skipped` and leaves every phase it jumped over `pending` in the DB forever
   (`harness_engine.py:1561-1563`). So on any skip-bearing workflow the live canvas paints a step that
   never ran as **Complete**, while a refresh restores it to **Not started**. That is simultaneously
   SPEC failure condition #2 (*"a step that never ran shows a completed ring"*), #3 (*"a refresh mid-run
   changes what any node says"*), and the Req-4 acceptance criterion. It is a one-token fix in a
   function the phase is already editing, and it is the highest-value thing this research found.

2. **`usePhases` does NOT reconcile at every reconnect.** `usePanelReconcile` *deliberately* ships no
   `visibilitychange` / `focus` / `pageshow` listener (D-086-15, stated in its own docblock) — it fires
   on `[threadId]` change plus a manual `reconcile()` escape hatch, and **no production code path calls
   `usePhases(...).reconcile()`** (grep: the only production `reconcile()` call in the tree is
   `PendingAskCard.tsx:239`, its own hook). SPEC Req 4's *"reconciles on fetch at every reconnect"* is
   therefore aspirational at HEAD, not shipped. The run surface can close it locally for one hook at
   near-zero cost; the plan must say which it is doing.

3. **The cheap SC#10 method works for the PROVIDER axis and does NOT carry the MODEL.** Traced end to
   end: `body.provider` → `override_provider` (`threads.py:847-848`) → `_user_settings.active_provider`
   → `run_producer(user_settings=…)` → `build_harness_run_context` → `wf_ctx.user_settings` →
   `run_task_sub_agent`'s `open_stream(parent_ctx.user_settings.active_provider, …)`. The provider
   genuinely reaches the phase executor. But `wf_ctx.model = resolve_workflow_ctx_model(user_settings)`
   reads `user_settings.**llm_model**` — never `body.model` — and the cross-provider guard then returns
   `_SUB_AGENT_MODEL_DEFAULTS[provider]`. So each row measures the provider you asked for and the
   provider's *default* model, not the id you sent. That is still a valid 8-row cross-provider board;
   it just has to be **recorded honestly**, and the effective model read back from the sub-agent `runs`
   rows rather than assumed.

**Primary recommendation:** build the derivation as one pure module (`frontend/src/lib/phaseState.ts`),
have the *page* do the `phase_index` → `slug` join and hand `WorkflowCanvas` a single
`runState?: (slug) => CanvasReading | undefined` prop that mirrors the shipped `marks?:` prop exactly —
a **≤ 15 insertion / ≤ 4 deletion** diff on `WorkflowCanvas.tsx` — and spend the first plan on the two
fail-opens (§ Pitfalls 1 and 2), both observed RED first, because they are the only places where the
product is currently telling a lie.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-phase run state derivation (`db status → Phase["status"] → CanvasReading`) | **Browser / Client — pure module** | — | It is a total function over values both views already hold. No server round trip; the whole point of Req 8 is one derivation, two consumers. Siting it in a component or a provider is what created the drift Req 8 exists to prevent. |
| The live phase stream (`phase_started` / `phase_completed` / …) | **API / Backend (Redis stream)** | Browser (reducer) | Shipped. The SPEC's "one run stream, two views" constraint forbids a second reducer, a second demux, or new events. This phase **consumes** the tier; it adds nothing to it. |
| The durable per-phase truth (`workflow_phases`) | **Database** | API (`GET /threads/{id}/workflow`) | The reconcile floor. Every reading the canvas may paint must be producible from this tier — that is Req 4's subset property, and it is exactly why `retrying` cannot be painted. |
| Run identity + the definition that actually ran | **API / Backend** (`GET /workflow-runs/{id}`) | Database (`workflow_runs` ⋈ `workflow_definitions`) | `workflow_definitions` is versioned (`slug` + `version`, one row per publish — measured), so `workflow_runs.definition_id` FKs a *specific version*. Only the server can resolve "the version that ran"; the client's `listPublishedWorkflows` only ever sees the current one. |
| Run-state → canvas paint (ring geometry, words, border) | **Browser / Client (presentational leaf)** | — | `PhaseNodeCard` imports nothing from `@xyflow/react` by construction (its docblock names Phase-188 reuse as the reason), so the paint is testable provider-free. |
| The `phase_index` → `slug` join | **Browser / Client — the PAGE, not the canvas** | — | Keeping the join in the page is what makes Req 2's *"zero `phase_index` in the canvas render path"* grep pass by construction, and what keeps the `WorkflowCanvas` diff to a prop mirror. |
| The deliverable (list + download) | **API / Backend** (`/threads/{tid}/workspace/files*`) | Browser (`useWorkspaceFiles(threadId)`) | Already thread-scoped and owner-gated (`_verify_thread_ownership`, `workspace.py:310-333`). A run is 1:1 with a thread, so `run.thread_id` is the whole integration. **Zero net-new file wire.** |
| Non-discoverability while `visual_workflow_canvas` is off | **API / Backend** (`require_canvas` + the OpenAPI filter) | — | Both halves are server-side. The client must never be the gate — D-181-02 / D-14. |

---

## Standard Stack

### Core

**No new runtime dependency is required or recommended for this phase.** Everything is already installed
and already used on this exact surface.

| Library | Version (measured) | Purpose | Why standard |
|---------|--------------------|---------|--------------|
| `@xyflow/react` | v12 (in tree, `WorkflowCanvas.tsx`) | The canvas plane the run view projects onto | Locked by the milestone (`canvasModel.toCanvas` is the projection); this phase adds one `data` field to existing node objects. `[VERIFIED: codebase — WorkflowCanvas.tsx module-scope nodeTypes/edgeTypes]` |
| `zustand` | in tree (`stores/streamsStore.ts`) | Holds `phasesByThread`; `usePhases` selects from it | Shipped. No new store, no new slice. `[VERIFIED: codebase]` |
| `react` `useMemo` / `memo` | 18/19 in tree | The `settledNodes` memo the run-state prop joins | The memo split (settled + drag overlay) is load-bearing for the anti-blink fix — see Pitfall 6. `[VERIFIED: WorkflowCanvas.tsx:926-973]` |
| `fastapi` / `asyncpg` / `supabase-py` | in tree | The one net-new read | `GET /workflows/validate` is the exact precedent (`workflows.py:600-612`). `[VERIFIED: codebase]` |
| `vitest` + `@testing-library/react` | in tree | Every frontend acceptance test | Gate-integrated (`scripts/vitest-count-gate.cjs`). `[VERIFIED: gate run 2026-08-05 — 2196 tests, 0 failing]` |
| `pytest` | in tree (`backend/venv`) | The route + gate tests | `[VERIFIED: 3541 collected 2026-08-05]` |

### Supporting

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| `vitest-axe` | in tree | A11y assertions on the run surface | The panel timeline is axe-gated (`PhaseTimeline.tsx:17-23`); a second view of the same run should not be less accessible. Use if the run surface introduces a new landmark/list. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A pure `lib/phaseState.ts` module | A React context or a zustand slice | Rejected: Req 8's acceptance is *"grep proves zero local re-derivations"*, and a pure module is the only shape where that grep is meaningful and where `PhaseNodeCard`'s provider-free-render promise survives. |
| The page doing the index→slug join | `WorkflowCanvas` doing it | Rejected: pushes `phase_index` into the canvas render path (fails Req 2's grep) and inflates the G-5-capped diff. |
| A new SSE channel for canvas state | — | Forbidden by SPEC Constraints ("no new Redis events, no new demux, no second reducer"). |
| `date-fns` / `dayjs` for elapsed | Hand-rolled `fmtElapsed` | The project already formats elapsed in the run card without a date library; adding one for one label is not justified. **See § Don't Hand-Roll for the one thing you genuinely should not hand-roll.** |

**Installation:** *(none)*

```bash
# No packages are added by this phase.
```

---

## Package Legitimacy Audit

**This phase installs no external packages.** The Package Legitimacy Gate is therefore **not applicable**
and no `slopcheck` run is required.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | — |

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

> If the planner introduces a dependency the research did not anticipate (e.g. a date library for the
> elapsed label, or an SVG arc helper), the gate applies to it and it must be run before the install
> lands. Neither is recommended.

---

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────────── BROWSER ─────────────────────────────┐
  USER clicks Run    │                                                                  │
  on WorkflowsPage ──┼─► ChatLayout.doRun (ChatLayout.tsx:233-268)                       │
                     │      │ createThread ─► uploadWorkspaceTemplate? ─► postMessage    │
                     │      │                                             { workflow_    │
                     │      │                                               definition_  │
                     │      │                                               id, content }│
                     │      ▼                                                            │
                     │   [TODAY]  selectThread(t); onNavigate("chat")   ◄── DELETED      │
                     │   [188]    getThreadWorkflow(t.id)                                │
                     │                └► active_workflow_run_id ─► onNavigate(           │
                     │                                              "workflow-run")      │
                     └──────────────────────────┬───────────────────────────────────────┘
                                                │
   ┌────────────────────────────────────────────▼──────────────────────────────────────┐
   │  RUN SURFACE  (ActiveView "workflow-run" — NON-chat branch, so no message list     │
   │                and no composer BY CONSTRUCTION: ChatLayout.tsx:541 splits them)    │
   │                                                                                   │
   │  ┌── one net-new read ────────────┐   ┌── shipped reads, reused verbatim ───────┐  │
   │  │ GET /workflow-runs/{id}        │   │ usePhases(run.thread_id)   [live slice] │  │
   │  │  ⟶ {status, claimed_at,        │   │ useWorkspaceFiles(run.thread_id)        │  │
   │  │     updated_at, thread_id,     │   │ downloadWorkspaceFile(thread_id, …)     │  │
   │  │     definition (the VERSION    │   └──────────────────┬──────────────────────┘  │
   │  │     that ran), phases[]}       │                      │                         │
   │  └──────────────┬─────────────────┘                      │                         │
   │                 │                                        │                         │
   │                 ▼                                        ▼                         │
   │        canvasModel.toCanvas(definition)          Phase[] (slice)                   │
   │                 │  nodes keyed by SLUG                    │                         │
   │                 │                                         │                         │
   │                 └──────────► JOIN BY phase_index ◄────────┘   ← D-188-01            │
   │                                    │                                                │
   │                     Map<slug, CanvasReading>   ← lib/phaseState.canvasReading()      │
   │                                    │             (TOTAL: unknown, never done)        │
   │                                    ▼                                                 │
   │           <WorkflowCanvas runState={(slug)=>map.get(slug)} editable={false} … />     │
   │                                    │  merged into node.data (one line, :952)         │
   │                                    ▼                                                 │
   │                         PhaseNode ──► PhaseNodeCard(status=…)                        │
   │                              ring geometry · word · border · reason line             │
   │                              seal ⛨ UNCHANGED at top-right (never conditional)       │
   └───────────────────────────────────┬───────────────────────────────────────────────┘
                                       │  the SAME lib/phaseState module
                                       ▼
                        PhaseTimeline / PhaseCard  (developer panel, UNTOUCHED wording)

  ┌──────────────────────────── BACKEND (all shipped except one route) ─────────────────┐
  │ POST /threads/{id}/messages ─► create_workflow_run  (db/workflows.py:141-219)       │
  │      ├ INSERT workflow_runs                                                          │
  │      ├ INSERT one workflow_phases row PER PhaseSpec, ALL status='pending'  ◄ KEY     │
  │      └ UPDATE threads.active_workflow_run_id            (one transaction, FK order)  │
  │                                                                                      │
  │ harness_engine.run_workflow ─► start_phase/complete_phase/fail_phase/skip_phase      │
  │      └ emits phase_* on run:{producer_run_id}  ──► StreamsProvider reducer           │
  │                                                                                      │
  │ GET /threads/{id}/workflow ─► phases_source_run_id = anchor ?? latest wf run         │
  │      └ returns slug + phase_index + status + phase_type for EVERY row (live & done)  │
  │                                                                                      │
  │ GET /workflow-runs/{id}  ◄── NET-NEW. Depends(require_canvas()) + canvas_caller      │
  └──────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
frontend/src/
├── lib/
│   └── phaseState.ts              # NEW — the ONE derivation (Req 8). Imports only @/types.
│   └── phaseState.test.ts         # NEW — must be added to BOTH gate knobs (see Pitfall 8)
├── components/workflows/
│   ├── WorkflowCanvas.tsx         # ± capped pass-through prop ONLY (≤15 ins / ≤4 del)
│   ├── PhaseNode.tsx              # + read data.run, pass `status` to the card
│   ├── PhaseNodeCard.tsx          # + narrow NodeRunStatus, render the ring + reason
│   └── runVocabulary.ts           # NEW (suggested) — the canvas BUSINESS word table.
│                                  #   Deliberately NOT in phaseState.ts (D-188-02:
│                                  #   one derivation, two vocabularies).
├── components/panel/
│   ├── PhaseCard.tsx              # + STATUS_META["unknown"] (compiler-forced by D-188-08)
│   └── PhaseTimeline.tsx          # − local TERMINAL_RUN_STATUSES (import from the module)
├── providers/
│   └── StreamsProvider.tsx        # − DB_PHASE_STATUS (moved) ; ?? "done" → ?? "unknown"
│                                  # ± reconcilePhases live-branch real-slug overlay
│                                  # ± finalizeAllPhasesForThread predicate  ◄ Pitfall 1
└── pages/
    └── WorkflowRunPage.tsx        # NEW — the fourth home

backend/app/
├── api/workflow_runs.py           # NEW router, prefix "/workflow-runs"
├── main.py                        # + one include_router line (~:731)
└── middleware/canvas_gate.py      # + "/workflow-runs/{workflow_run_id}" to CANVAS_GATED_PATHS
                                   #   (schema half only — see Open Question 3)
backend/tests/
├── test_188_workflow_run_read.py  # NEW
├── test_revert_byte_identical.py  # + a 404-when-off assertion (the file's own header REQUIRES it)
└── test_182_canvas_gate.py        # ± _CANVAS_PATHS / _CANVAS_SCHEMAS literals (exact-set fence)
```

### Pattern 1 — The projection seam: run state arrives on `node.data`, exactly like `technical` and `verdict`

**What:** `WorkflowCanvas` already merges page-supplied, server-derived values onto each phase node's
`data` in one line inside the `settledNodes` memo. Run state is a third value in that same merge.

**When to use:** always, for this phase. It is the shipped seam and it is why `PhaseNode` remains a
context-free leaf.

**Example — the shipped line, measured at `WorkflowCanvas.tsx:952`:**

```tsx
// Source: frontend/src/components/workflows/WorkflowCanvas.tsx:926-955 (read at db086240)
const settledNodes = useMemo<CanvasNode[]>(
  () =>
    projection.nodes.map((node) => {
      if (node.type !== CANVAS_NODE_TYPES.phase) return node
      /* … position / measured / draggable / selected … */
      return {
        ...node,
        /* … */
        // The verdict is threaded exactly as the ⌥ reveal is (D-183-08 / D-184-06), so
        // `PhaseNode` stays a context-free leaf and cannot grow a second source of
        // truth for a value only the server owns.
        data: { ...node.data, technical: showTechnical, verdict: marks?.(node.id) },
      }
    }),
  [projection.nodes, selectedSlug, showTechnical, editable, marks, nudges, measuredById],
)
```

The 188 change is `run: runState?.(node.id)` appended to that object literal, `runState` added to the
dependency array, plus a `runState?: (slug: string) => CanvasReading | undefined` prop that mirrors the
shipped `marks?:` prop declaration at `:807`. **That is the whole `WorkflowCanvas` diff.**

### Pattern 2 — Join by index in the PAGE; hand the canvas a slug lookup

**What:** the definition gives `phase_index → slug`; the slice gives `phaseIndex → status`. The page
composes them into `Map<slug, CanvasReading>` and closes over it.

**Why this shape:** it satisfies D-188-01 (index join) and Req 2 (no `phase_index` in the canvas render
path) simultaneously, and it keeps the G-5-capped file to a prop mirror.

```ts
// The page (WorkflowRunPage). NOT the canvas.
const byIndex = new Map(phases.map((p) => [p.phaseIndex, p]))
const readingBySlug = new Map<string, CanvasReading>(
  definition.phases.map((spec) => [spec.slug, canvasReading(byIndex.get(spec.phase_index))]),
)
const runState = useCallback((slug: string) => readingBySlug.get(slug), [readingBySlug])
```

`canvasReading(undefined)` must resolve to **`"not-started"`**, not `"unknown"` — a definition node with
no matching row is a step the harness has not inserted, which is a *known* state. Reserve `"unknown"`
for a row that exists and carries an unrecognised status. Conflating them is how the SPEC's
"visually distinct from both done and not started" requirement gets quietly lost.

### Pattern 3 — The fourth home: an `ActiveView` member with a MANDATORY render branch

**What:** `App.tsx:91` holds an 11-member `ActiveView` union. `ChatLayout` renders `activeView === "chat"`
as one branch and everything else as a ternary chain ending in a bare `<KnowledgeHealthPage />`.

**⚠ The trap, measured live at `ChatLayout.tsx:645`:** the trailing `else` is a **positional fallback**.
Adding `"workflow-run"` to the union WITHOUT adding a branch before that else silently renders the
Knowledge-Health page. The IA reference names this exact hazard and every prior view-adding phase
(103, 118, 137, 146, 166) records the same instruction in an inline comment.

**The free win:** the composer and the message list live inside the `activeView === "chat" ?` branch
(`ChatLayout.tsx:541-576`), and `<WorkspacePanel>` is inside it too. A view added to the **else** side
therefore renders neither — **SPEC Req 6's "no message list and no composer" is satisfied structurally**,
and the test that asserts it is asserting a property of the layout rather than a discipline.

**The cost that comes with it:** the run surface also gets no `WorkspacePanel`, so it must render its own
deliverable list. See Open Question 9.

### Pattern 4 — The one net-new read, shaped exactly like `POST /workflows/validate`

```python
# Source: backend/app/api/workflows.py:600-612 (the D-182-05 precedent, read at db086240)
@router.post(
    "/validate",
    response_model=ValidateResponse,
    dependencies=[Depends(require_canvas())],  # D-182-05 — require_canvas ALONE (never require_visible)
)
async def validate_workflow(
    body: WorkflowDefinition,
    # WR-08: ``require_canvas`` above ALREADY validated this bearer token and published the
    # identity on ``request.state.canvas_caller``. Consume it — do NOT re-run get_current_user.
    current_user: dict = Depends(canvas_caller),
    supabase=Depends(get_supabase),
) -> ValidateResponse:
```

Copy this posture exactly: `dependencies=[Depends(require_canvas())]` **alone** (never stacked with
`require_visible`, which raises 403 and would leak the route's existence), and `Depends(canvas_caller)`
for the identity so the bearer token is not validated twice.

**Ownership:** the route must scope on the run owner itself. `workflow_runs` carries `user_id` (measured)
and `thread_id`; the safest shape mirrors `threads.py`'s posture — ownership-check FIRST, 404 (never 403,
never 200-with-empty) on a miss, so a run id belonging to someone else is indistinguishable from a run id
that does not exist.

### Anti-Patterns to Avoid

- **Deriving run state inside `PhaseNode` or `PhaseNodeCard`.** Both are declared pure presentational
  leaves; `PhaseNodeCard`'s docblock names Phase-188 reuse *outside a `ReactFlowProvider`* as the reason
  it imports nothing from the graph library. A derivation in the leaf destroys that and fails Req 8's grep.
- **Importing `StreamsProvider` from `WorkflowCanvas`.** The ROADMAP's 067.5 Branch-D3 guard keeps the
  canvas out of the stream path; the page is the only component that should touch `usePhases`.
- **Filling badge slot 1 with run state.** `BadgeSlots` is a max-2 tuple; slot 2 is `Waits for you`.
  153-A won *because* it spends no slot. A third badge is a typecheck error, not a review comment.
- **Making the ⛨ seal conditional on run state.** `PhaseNodeCard.tsx:403-404` states the invariant and
  the props docblock repeats it. It is SPEC Req 1's second assertion.
- **Adding `overflow-hidden` anywhere in the node subtree or its wrapper.** The 3D mark already
  overflows upward by 26px (`PhaseNodeCard.tsx:456`, `top-[-26px]`, `62×62`); the ring is its sibling.
- **Re-inheriting `references/workflow-run-surface.md`'s D1/D4.** That reference (Phase 094) says the
  panel owns the live spine, the chat is a thin receipt, and the composer LOCKS during a run — a run is
  *"a bounded episode, never a page."* RUNVIZ-03 and SPEC Req 6 **override** it. Read it for the
  `PhaseCard` anatomy and the honesty table; do not read it for where the run lives. (Its honesty table
  is also stale on one point: it lists persisted `phase_type` as NET-NEW wire, and it has since shipped —
  `threads.py:1218-1232` derives it from the definition JSON.)

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Mapping a DB phase status to a client status | A second `Record<string, …>` in the canvas | The shared `phaseStatusFromDb` (moved out of `StreamsProvider.tsx:3292`) | Two maps is precisely the drift Req 8 exists to forbid, and the second one would inherit or re-invent the `?? "done"` bug. |
| Knowing which run statuses are terminal | A new set literal on the run surface | `TERMINAL_RUN_STATUSES`, moved out of `PhaseTimeline.tsx:40` | Same reason. Also, moving it is what makes the `timed_out` question answerable in one place (Open Question 5). |
| Listing / downloading the deliverable | A new `GET /workflow-runs/{id}/files` | `useWorkspaceFiles(run.thread_id)` + `downloadWorkspaceFile(thread_id, fileId, filename)` | Both are already thread-parameterised and owner-gated. A run is 1:1 with a thread. This is the cheapest win in the phase and it costs zero backend work. |
| Rendering a `.docx` preview | Any client-side docx renderer | The shipped `Fallback` — *"No preview available · Download"* (`FilePreview.tsx:262-268`) | `render_template` produces `.docx`; DOCX/PPTX/XLSX/PDF are download-only by decision (`references/approval-and-review.md`). Req 7 asks for *listed and downloadable*, which is achievable. Do not promise a preview. |
| The 404-when-off gate | A client-side flag check | `Depends(require_canvas())` | Client gating is a D-14 / D-181-02 red-line violation; `require_canvas` already fails closed, resolves the flag before auth, and hands off the validated identity (WR-08). |
| Resolving "which definition version ran" | Re-fetching `listPublishedWorkflows` | `workflow_runs.definition_id` JOIN `workflow_definitions` server-side (D-188-14) | `workflow_definitions` is versioned (`slug` + `version`, one row per publish — measured). The published-list read only ever returns the *current* version, so a re-opened old run would be drawn against a definition it never executed. |
| The arc gap placement | An SVG `transform` rotation | `stroke-dasharray` + `stroke-dashoffset`, `offset = (D + G/2) − p` | D-188-07(2): setting the SVG `transform` attribute *and* CSS `transform-box`/`transform-origin` composes them and pivots about a doubled offset. That bug shipped twice in the sketch's own drafts. |

**Key insight:** in this phase almost every "build" instinct is wrong. The correct instinct is *find the
shipped thing and hand it a different `threadId`.* The two exceptions — the shared derivation module and
the one net-new route — are both extractions/additions the milestone's own G-5 note already asked for.

---

## Runtime State Inventory

> Included because Req 8 is an extraction (a refactor), and because the phase edits a reducer whose
> output is cached per thread in a live store. No rename or data migration is involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `workflow_phases` rows are written by exactly ONE code path — `create_workflow_run` (`db/workflows.py:208`), one row per `PhaseSpec` at run creation, all `status='pending'`. No other `INSERT INTO workflow_phases` exists in `backend/app` (grep, measured). Statuses are then UPDATEd by `start_phase`/`complete_phase`/`fail_phase`/`skip_phase` (`db/workflows.py:958-1015`). | **None — read-only phase.** But note the consequence: the DB rows for a whole run exist from t=0, which is why the live real-slug overlay (D-188-22b) is COMPLETE, not partial. |
| **Live service config** | None. No n8n / Datadog / Cloudflare surface is touched. | None — verified: the phase adds one FastAPI route and frontend code only. |
| **OS-registered state** | None. | None — verified: no scheduler, pm2 or service registration is involved. |
| **Secrets / env vars** | None net-new. The `visual_workflow_canvas` flag is an `app_settings` feature-visibility record, not an env var, and it already exists. | **None.** ⚠ But see § Environment Availability — the SC#10 scoreboard needs a configured API key per provider, and `override_provider` **silently returns the settings unchanged** when a provider has no key. |
| **Build artifacts / installed packages** | None — no `package.json` / `pyproject.toml` change. The sandbox image tag is untouched, so the Phase-158 deploy-drift check (`scripts/check-deploy-drift.sh`) has nothing to reconcile. | **None.** |
| **In-memory client state (net-new category for this phase)** | `phasesByThread` (zustand) is keyed by thread and is *replaced* by `replacePhasesForThread` on reconcile. Widening `Phase["status"]` with `"unknown"` changes a value that can live in that map across a hot reload. | **None at runtime** (no persistence), but every consumer of `Phase["status"]` must be total. Measured: only `STATUS_META` (`PhaseCard.tsx:67`) is an exhaustive `Record`; every other consumer is a `===` comparison or a `switch` with a `default`. The widening therefore produces **exactly one** compiler error, which is D-188-08's mechanism working as designed. |

---

## Common Pitfalls

### Pitfall 1 — ⚠ THE REACHABLE FAIL-OPEN THE SPEC DID NOT NAME: `finalizeAllPhasesForThread` sweeps `pending` → `done`

**What goes wrong:** on a successful run completion, every phase still in `running | retrying | **pending**`
is set to `done` in the live slice. A phase that **never ran** is painted Complete.

**Why it happens (measured, both halves):**

```ts
// frontend/src/providers/StreamsProvider.tsx:2811-2826 — the sweep
finalizeAllPhasesForThread: (threadId) =>
  useStreamsStore.setState((s) => {
    /* … */
    const swept = prev.map((p) => {
      if (p.status === "running" || p.status === "retrying" || p.status === "pending") {
        changed = true
        return { ...p, status: "done" as const }   //  ◄── pending → done
      }
      return p
    })
```

```ts
// frontend/src/providers/StreamsProvider.tsx:1034-1035 — the call site
if (status === "completed")
  useStreamsStore.getState().actions.finalizeAllPhasesForThread(threadId)
```

```python
# backend/app/services/harness_engine.py:1561-1563 — why `pending` is reachable at completion
if outcome.kind == "skip_to":
    await skip_phase(pool, phase_id)          # marks ONLY the CURRENT phase
    ...
    target_i = index_by_slug.get(outcome.target_slug)   # cursor jumps forward
```

Every phase *between* the skipping phase and the skip target keeps `status='pending'` in
`workflow_phases` for the life of the run. Nothing ever revisits them.

**The observable defect:** on any workflow with a `skip_to_phase` validator that fires, the live canvas
shows those jumped-over steps as **Complete**; a page refresh runs `reconcilePhases`, reads `pending`
from the DB, and shows them as **Not started**. That is SPEC failure condition #2 *and* #3 *and* the
Req-4 acceptance criterion, all at once — and unlike `?? "done"`, it is reachable today with shipped data.

**How to avoid:** narrow the sweep's predicate to `running | retrying`. The 098-UAT bug it was written
for was *"a phase stuck running forever after a missed `phase_completed`"*; `pending` was never part of
that bug and its inclusion was over-reach. One token.

**Warning signs:** any test that drives a skip-bearing fixture to completion and then reconciles will
show the two readings disagreeing. **Write that test first, observe it RED, then fix** — it is a
stronger falsification than the `?? "done"` one because it needs no synthetic status value.

### Pitfall 2 — The `?? "done"` fallback, and why the falsification test needs care

**What goes wrong:** `DB_PHASE_STATUS[r.status] ?? "done"` (`StreamsProvider.tsx:3337`) maps an
unrecognised DB status to success.

**Why it happens:** the map covers all five values in `workflow_phases_status_check`
(`pending｜active｜completed｜failed｜skipped` — measured in `full-schema.sql`), so it reads as
unreachable. The `findIndex → -1` gauntlet fail-open had the same "unreachable" argument.

**How to avoid:** `?? "unknown"`, plus the compiler-forced `STATUS_META["unknown"]` entry.

**Warning sign / the care needed:** this path is only reachable through the **terminal** branch of
`reconcilePhases` (rows from `wf.phases`). The **live** branch never touches `DB_PHASE_STATUS` at all —
it synthesises statuses positionally. So the RED observation must drive a *terminal* reconcile with an
unmapped status string, not a live one. A test that drives the live branch will be green before and
after the fix and will prove nothing.

### Pitfall 3 — "Reconciles on fetch at every reconnect" is not true at HEAD

**What goes wrong:** the plan asserts a property the code does not have.

**Why it happens (measured):** `usePanelReconcile`'s own docblock states the exclusion —

```ts
// frontend/src/hooks/usePanelReconcile.ts:20-22
//   - NO visibilitychange/focus/pageshow listeners (D-086-15 — reconcile fires
//     ONLY on thread-switch [threadId] + the manual `reconcile()` escape hatch).
```

and grep over `frontend/src` (excluding tests) finds exactly **one** production `reconcile()` call —
`PendingAskCard.tsx:239`, for its own hook. **No code path calls `usePhases(...).reconcile()`.**

**How to avoid:** pick one and say so.
- *(recommended, cheapest)* Scope Req 4's acceptance to what a test can drive: the subset property is a
  pure-function assertion on `canvasReading`, and the before/after parity assertion calls the returned
  `reconcile()` directly. Record in the plan that reconnect-driven reconcile is not shipped.
- *(optional, still cheap)* Have `WorkflowRunPage` call `reconcile()` on its own reconnect edge — it
  already holds the hook's return value. This is local to the new surface and touches no shared hook.

**Warning sign:** a plan sentence containing "at every reconnect" with no corresponding listener or
call site.

### Pitfall 4 — The two `run_id`s (D-188-11), and the race that turns out not to exist

**What goes wrong:** navigating with `PostMessageResponse.run_id` yields a surface that resolves nothing.

**Why it happens:** `MessageCreate` → the handler mints `run_id = uuid4()` for the **producer `runs`** row,
and separately `create_workflow_run` returns the **`workflow_runs`** id. Both are called `run_id` in
conversation. `PostMessageResponse` returns only the former (`api.ts:302-312`).

**Measured good news:** there is **no race**. `create_workflow_run` (which sets
`threads.active_workflow_run_id` inside the same transaction) is called at `threads.py:928-948`, and the
`JSONResponse` is returned at `threads.py:1011-1026`. The anchor is committed before the POST resolves.
So `getThreadWorkflow(thread.id).active_workflow_run_id` immediately after `postMessage` is
deterministic. D-188-11's fallback ("if there is a race, accept a thread id") is not needed.

**How to avoid:** one extra `getThreadWorkflow` call in `doRun`. *(An additive `workflow_run_id` key on
the POST response is the alternative — 1 line, but it touches `threads.py`, a G-5-firing file, and it
changes the response bytes for workflow kickoffs. The extra fetch is the lower-risk default.)*

### Pitfall 5 — Adding the `ActiveView` member without the render branch

**What goes wrong:** the run surface renders the Knowledge-Health page.

**Why it happens:** `ChatLayout.tsx:645`'s trailing `<KnowledgeHealthPage />` is a positional fallback in
a ternary chain, not a `default:` that throws.

**How to avoid:** add the branch immediately before it, following the five inline comments already in the
file that say exactly this.

**Warning sign:** a test that navigates to `"workflow-run"` and finds a KB-health heading.

### Pitfall 6 — Breaking the `settledNodes` / drag-overlay memo split

**What goes wrong:** the canvas cards flicker at ~60fps during a drag (the operator-reported
"blinking while I drag").

**Why it happens:** `PhaseNode` is memoized, and that memo only works because `data` keeps identity for
the whole drag — which is only true because `WorkflowCanvas` splits `settledNodes` (no drag deps) from
the thin drag overlay (`WorkflowCanvas.tsx:961-973`, and `PhaseNode.tsx:293-308` documents the pairing).

**How to avoid:** put `runState` in the `settledNodes` memo (which already excludes `dragOverlay`), and
make sure the page memoizes the lookup function. Do **not** build a fresh `Map` per render inside an
un-memoized page body.

**Warning sign:** run state passed as an inline arrow at the call site — `runState={(s) => map.get(s)}` —
which is a new function identity every render and defeats the memo. Wrap in `useCallback`.

### Pitfall 7 — Assuming the two canvas-gate halves are symmetric

Covered in full under Open Question 3. Short form: `require_canvas` is the request-side authority and
needs nothing added; the **OpenAPI-strip** half keys off the FastAPI path *template*, and
`test_182_canvas_gate.py` carries an **exact-set** fence over test-local literals, so adding to
`CANVAS_GATED_PATHS` without updating that test is RED, and *not* adding is a silent weakening.

### Pitfall 8 — A new test file that neither runs nor pins

Covered in full under Open Question 8. Short form: `TARGETS` decides what RUNS, `BASELINE` decides what
is PINNED, and a file outside `src/components/workflows/` lands outside **both** by default.

---

## Code Examples

### 1. The shared module (Req 8) — the derivation, and only the derivation

```ts
// frontend/src/lib/phaseState.ts  (NEW — imports ONLY from @/types, so no ESM cycle is possible)
import type { Phase } from "@/types"

/** Moved VERBATIM out of StreamsProvider.tsx:3292 (Phase 098-UAT run-honesty fix B). */
export const DB_PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "pending",
  active: "running",
  completed: "done",
  failed: "failed",
  skipped: "skipped",
}

/** TOTAL over every string. Success is NEVER the fallback (SPEC Req 3). */
export function phaseStatusFromDb(raw: string): Phase["status"] {
  return DB_PHASE_STATUS[raw] ?? "unknown"
}

/** The seven canvas readings (D-188-04). */
export type CanvasReading =
  | "not-started" | "running" | "done" | "failed"
  | "skipped" | "waiting-for-you" | "unknown"

/**
 * D-188-03: `retrying` collapses to `running` HERE, in one named place, so the
 * Req-4 subset property is a property of ONE function.
 * D-188-01 note: a definition node with NO matching row is "not-started" (a known
 * state), never "unknown" (a row exists but its status is unrecognised).
 */
export function canvasReading(phase: Phase | undefined): CanvasReading {
  if (!phase) return "not-started"
  if (phase.pendingAsk != null) return "waiting-for-you"
  switch (phase.status) {
    case "pending":  return "not-started"
    case "running":
    case "retrying": return "running"
    case "done":     return "done"
    case "failed":   return "failed"
    case "skipped":  return "skipped"
    default:         return "unknown"   // includes the new "unknown" member
  }
}

/** Moved out of PhaseTimeline.tsx:40. See Open Question 5 re `timed_out`. */
export const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"])
```

### 2. The Req-4 subset property, as a real assertion

```ts
// The property: everything the canvas can paint must be producible from a reconcile.
// This is why `retrying` is not a CanvasReading value at all.
const RECONCILABLE: ReadonlySet<Phase["status"]> = new Set(
  // exactly the five values in workflow_phases_status_check, mapped, plus the new fallback
  [...Object.values(DB_PHASE_STATUS), "unknown"] as Phase["status"][],
)
const PAINTABLE = new Set<CanvasReading>([
  "not-started", "running", "done", "failed", "skipped", "waiting-for-you", "unknown",
])
// For every reconcilable status, canvasReading() must land inside PAINTABLE …
for (const s of RECONCILABLE) expect(PAINTABLE.has(canvasReading(mk(s)))).toBe(true)
// … and "retrying" must NOT be reachable as an output.
expect([...PAINTABLE]).not.toContain("retrying")
```

### 3. The `WorkflowCanvas` pass-through — the ENTIRE capped diff

```tsx
// 1) type import — fold into the existing nodePresentation/canvasModel import block
import type { CanvasReading } from "@/lib/phaseState"

// 2) the prop, mirroring the shipped `marks?:` declaration at :807
  /**
   * Phase 188 (RUNVIZ-01) — the run reading for one node, or `undefined` when this
   * canvas is not showing a run. Supplied by the PAGE, which owns the phase_index
   * join (D-188-01) — this canvas derives no run state and reads no phase_index.
   * OPTIONAL and inert when absent: every shipped Builder caller renders unchanged.
   */
  runState?: (slug: string) => CanvasReading | undefined

// 3) destructure (one identifier added to the existing list at :873)
  runState,

// 4) the merge — MODIFIED line at :952
  data: { ...node.data, technical: showTechnical, verdict: marks?.(node.id), run: runState?.(node.id) },

// 5) the memo deps — MODIFIED line at :955
  [projection.nodes, selectedSlug, showTechnical, editable, marks, nudges, measuredById, runState],
```

Measured against the `marks` precedent this is **~11 insertions / 2 deletions**. See Open Question 7.

### 4. The backend route skeleton

```python
# backend/app/api/workflow_runs.py  (NEW)
router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])

@router.get("/{workflow_run_id}", response_model=WorkflowRunRead,
            dependencies=[Depends(require_canvas())])   # D-182-05 posture — ALONE, never require_visible
async def read_workflow_run(
    workflow_run_id: UUID,
    current_user: dict = Depends(canvas_caller),        # WR-08 hand-off, no second GoTrue round-trip
    supabase: Client = Depends(get_user_supabase_client),
) -> WorkflowRunRead:
    """One workflow run + the definition VERSION that ran + its durable phase rows.

    Ownership-gated FIRST (404, never 403, never 200-with-empty) so a foreign run id is
    indistinguishable from a nonexistent one — the same posture threads.py:1050 takes.
    """
```

The FastAPI path template this publishes is **`/workflow-runs/{workflow_run_id}`** — that exact string is
what the OpenAPI filter needs (Open Question 3).

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| A finished run's timeline blanked on revisit (reconcile returned `[]`) | `GET /threads/{id}/workflow` resolves `phases_source_run_id = anchor ?? latest workflow_run by thread` and returns the durable per-phase array | Phase 098-UAT fix B | Req 7's terminal re-open is *mostly already built*; the run needs an address, not a new read of its spine. |
| `phase_type` lost on reload (every historical row rendered as "Step") | `WorkflowPhaseState.phase_type` derived server-side from the definition JSON (`threads.py:1218-1232`) | shipped since `references/workflow-run-surface.md` was written | That reference's honesty table still lists it as NET-NEW wire. **It is not.** Do not re-plan it. |
| The canvas node id could be positional | node id = `phase.slug` | Phase 184 | Makes `runState?: (slug) => …` the natural prop signature; the index join stays in the page. |
| Grounding shown as a word-badge in slot 1 | Grounding shown as the ⛨ corner seal (shape, no colour, no slot) | Phase 185-08/185-09 | Frees slot 1 for 188/189 and makes "the seal is never conditional on run state" a testable invariant rather than a preference. |
| The ⌥ reveal was a TITLE swap | The ⌥ reveal is a SUBTITLE swap; `technicalLine` deliberately left to 188 | Phase 187-09 | The card body budget is real. 154-A's reason line, the ⌥ subtitle and `technicalLine` all want the same column — plan them as ONE budget (D-188-17). |
| "The run is an episode in a thread, never a page"; the composer locks during a run | The run has its own surface; launching does not enter chat | RUNVIZ-03, operator 2026-07-31 | **Supersedes** SEED-051, D-094-UNIFY and `references/workflow-run-surface.md` D1/D4. All three carry dated override notes. |

**Deprecated / outdated (do not re-inherit):**
- `references/workflow-run-surface.md` **D1** (panel owns the spine) and **D4** (composer locks) — overridden by RUNVIZ-03.
- Sketch 130-C's *"anchor the elapsed timer to `started_at`"* — right in spirit, **wrong in field**: `workflow_runs` has no such column (measured). D-188-18 substitutes `claimed_at`.
- `references/icon-convention.md` §4 cites `⤳` at `PhaseNode.tsx:238`; it is at **:257** at HEAD. The mark and the rule are correct; the line number drifted.
- CONTEXT.md cites the `Phase["status"]` union at `types/index.ts:1013`; it is at **:1014** at HEAD.
- CONTEXT.md cites `VERDICT_MARK` at `nodePresentation.ts:176`; the const begins at **:174** (the `unknown` member is at :185). `VerdictMarkKind` is at :121.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `_SUB_AGENT_MODEL_DEFAULTS[provider]` is what the operator's environment will actually resolve for each SC#10 row. This holds **only when the operator's saved `user_settings.llm_model` is cross-provider to the row's provider**; if it happens to be same-provider, the candidate passes through and the row measures the saved model instead. | Open Question 1 | The scoreboard's "model" column would be wrong for one or two rows. Mitigation is mechanical: read the effective model back from the sub-agent `runs` rows rather than predicting it. `[ASSUMED]` |
| A2 | `llm_single` and `programmatic` phases may not mint a sub-agent `runs` row (only `run_task_sub_agent` was traced to `insert_run`, `task_service.py:553-560`). Not verified per phase type. | Open Question 1 | If a chosen SC#10 fixture workflow contains no agent phase, the per-phase effective-model evidence would be absent and the row would need a LangSmith read instead. `[ASSUMED]` |
| A3 | A run whose `claimed_at` is NULL is genuinely "queued" rather than "claimed but unrecorded". Inferred from the column's presence in the claim path; the claim writer was not read. | D-188-18 support | The "Waiting to start" reading could appear on a run that is actually processing. Cheap to verify by reading the claim/lease writer before the elapsed label is built. `[ASSUMED]` |
| A4 | The frontend full-suite rot figure (~14-17 pre-existing failures outside the count gate's blast radius) is carried from prior sessions and was **not** re-measured here. The gate's own blast radius **was** measured and is 0-failing. | Validation Architecture | Only affects whether a full `vitest run` can be quoted as a gate. The count gate can, and should be, the quoted gate. `[ASSUMED]` |
| A5 | Adding `/workflow-runs/{workflow_run_id}` to `CANVAS_GATED_PATHS` removes exactly the new route and its response models from `/openapi.json` while off, with no collateral removal. The filter derives removals from the reference graph and subtracts `kept_refs`, so this should hold — but it depends on `WorkflowRunRead` (and the `WorkflowDefinition` it embeds) not being referenced by a non-canvas route. **`WorkflowDefinition` IS referenced by `POST /workflows/validate` (a canvas route) and possibly by publish routes (non-canvas).** | Open Question 3 | If `WorkflowDefinition` is shared with a non-canvas route it stays published (correctly), and the exact-set assertion in `test_182_canvas_gate.py` must list only the models that genuinely move. Verify by running the test after the change and reading the diff it reports. `[ASSUMED]` |

---

## Open Questions — ANSWERED

> These ten were the brief's highest-value output. Each answer states what was executed or read.

### 1. [BLOCKING for SC#10] Does per-request `model` + `provider` reach a HARNESS run's phases?

**Answer: the PROVIDER does; the MODEL does not.** `[VERIFIED: code trace at db086240]`

The chain, read end to end:

| Step | File:line | What happens |
|---|---|---|
| 1 | `models/message.py:8-12` | `MessageCreate` accepts `model`, `provider`, and `workflow_definition_id` on the same body. The wire is available. |
| 2 | `api/threads.py:847-848` | `if body.provider and body.provider != _user_settings.active_provider: _user_settings = override_provider(_user_settings, body.provider)` |
| 3 | `api/threads.py:858-860` | `resolve_run_model(body=…, user_settings=…)` — when `body.model` is registry-verified it ALSO calls `override_provider(user_settings, capability_provider)` (`run_model_resolution.py:272-279`). So even a bare `body.model` flips the active provider. |
| 4 | `models/user_settings.py:957-967` | `override_provider` swaps `active_provider`, `llm_api_key`, `llm_base_url` and `available_models`. **It does NOT touch `llm_model`.** ⚠ It returns the settings **UNCHANGED** if the target provider has no `api_key` — a silent no-op. |
| 5 | `api/threads.py:930-948` | `create_workflow_run(..., model=_resolved_model, ...)` → `workflow_runs.model` records the REQUESTED model. |
| 6 | `api/threads.py:983-999` | `run_producer(..., user_settings=_user_settings, ...)` — the same mutated object. |
| 7 | `services/workflow_kickoff.py:432-447` | `wf_ctx = SimpleNamespace(user_settings=user_settings, model=resolve_workflow_ctx_model(user_settings), …)` |
| 8 | `services/sub_agent_models.py:231-259` → `:165-196` | candidate = `user_settings.llm_model` (**never `body.model`**); the inferred-provider gate fires on a cross-provider candidate and returns `_SUB_AGENT_MODEL_DEFAULTS[active_provider]`. |
| 9 | `services/harness/phase_types.py:350-352` | `_effective_model(phase, ctx) = phase.config.model or ctx.model` |
| 10 | `services/task_service.py:256-310` | `_provider = provider or user_settings.active_provider`; `open_stream(_provider, GatewayRequest(model=model, …))` |

**Consequences for the scoreboard, stated rather than absorbed:**

- ✅ **Provider routing is genuinely per-request.** An 8-row board driven by `body.provider` on
  `POST /threads/{id}/messages` with `workflow_definition_id` set **does** exercise eight different
  provider SDKs inside the harness. The cheap, non-mutating Phase-185 method survives — the operator's
  global settings are never written.
- ⚠ **The model each row measures is `_SUB_AGENT_MODEL_DEFAULTS[provider]`, not the id you sent** (given
  a cross-provider saved default — see A1). Send `body.model = _SUB_AGENT_MODEL_DEFAULTS[provider]`
  anyway, so `workflow_runs.model` / `runs.model` bookkeeping agrees with what runs.
- ⚠ **`override_provider` fails silently on a missing key.** A row for an unconfigured provider will run
  on the *previous* provider and look like a pass. **The board MUST verify by reading `runs.provider`
  back**, and record a mismatch as ⛔ with the reason "no API key configured", never as a pass.
- ⚠ **OpenRouter is the one genuinely risky row.** `_SUB_AGENT_MODEL_DEFAULTS["openrouter"] = ""` and
  `openrouter ∈ _FLEXIBLE_PROVIDERS`, so the inferred-provider gate never fires and the candidate
  (`user_settings.llm_model`, e.g. `gpt-5.4-mini`) passes through to the OpenRouter SDK unslashed →
  a likely 404. **For the OpenRouter row, pin the phase model** via `phase.config.model` in a fixture
  definition (e.g. `z-ai/glm-5.2`, registry-backed) — or record the row ⛔ with this as the reason.
- ⚠ **`phase.config.model` beats everything.** If the SC#10 fixture workflow pins a per-phase model, the
  provider override still routes the SDK but the model is the pinned one → guaranteed cross-provider
  mismatch. **Use a fixture whose phases carry no `config.model`.**

**The honest evidence path (DB-only, no UI dependency):**

```sql
-- what actually served each agent phase of a run
SELECT r.model, r.provider, r.status
FROM runs r
WHERE r.parent_run_id = '<producer run_id>';        -- task_service.py:553-560

-- the phase-level truth this phase asserts
SELECT wr.status, wp.phase_index, wp.slug, wp.status
FROM workflow_runs wr JOIN workflow_phases wp ON wp.workflow_run_id = wr.id
WHERE wr.id = '<workflow_run_id>' ORDER BY wp.phase_index;
```

**The roster, DERIVED not transcribed** `[VERIFIED: executed against app.config at db086240 — 61 models, 8 provider groups]`:

| # | Provider | Newest registry-backed id | What the harness will actually run | `emit_tier` | `native_tools` |
|---|---|---|---|---|---|
| 1 | `openai` | `gpt-5.6-sol` / `-terra` / `-luna` (17 ids) | `gpt-5.4-mini` | `force_strict` | ✓ |
| 2 | `anthropic` | `claude-sonnet-5` (7 ids) | `claude-haiku-4-5-20251001` | `force` | ✓ |
| 3 | `google` | `gemini-3.5-flash` (7 ids) | `gemini-3.5-flash` | `force` | ✓ |
| 4 | `deepseek` | `deepseek-v4-pro` (2 ids) | `deepseek-v4-flash` | `force` | ✓ |
| 5 | `zhipu` | `glm-5.2` (8 ids) | `glm-5-turbo` | `force` | ✓ |
| 6 | `minimax` | `MiniMax-M3` (8 ids) | `MiniMax-M2.7-highspeed` | `force` | ✓ |
| 7 | `moonshot` | `kimi-k2.6` (3 ids) | `kimi-k2.6` | **`coerce`** (weakest) | ✓ |
| 8 | `openrouter` | `z-ai/glm-5.2` (9 ids) | ⚠ **the saved `llm_model`, unslashed** | `force` | **✗** |

All seven native `_SUB_AGENT_MODEL_DEFAULTS` entries are registry-backed
(`capability_source = registry`); OpenRouter's is `""` and is not.

**Recommendation:** author the scoreboard as a small script (`scripts/` has precedent —
`eval_cross_provider.py`, `longmsg_workflow_smoke.py`) that derives the roster from `MODEL_CAPABILITIES`
at run time, posts eight kickoffs, and reads verdicts from the DB. Estimated cost: one plan, no new
infrastructure. **Do NOT** build eight published workflow variants — the provider axis already works.

---

### 2. [BLOCKING for D-188-11] Is `threads.active_workflow_run_id` set when `POST /threads/{id}/messages` returns?

**Answer: YES, deterministically. There is no race.** `[VERIFIED: code read at db086240]`

`create_workflow_run` is invoked at `threads.py:930-948`, *before* the producer task is spawned and
*before* the `JSONResponse` at `threads.py:1011-1026`. Inside
`db/workflows.py:190-218` all three writes — `INSERT workflow_runs`, N × `INSERT workflow_phases`,
`UPDATE threads.active_workflow_run_id` — run in **one `con.transaction()`** in FK-safe order. The
handler's own comment states the ordering intent: *"AFTER the producer-shell `runs` row exists … and
BEFORE the producer spawns, so agent_runner reads a non-null anchor."*

**Confirmed on the id trap:** `PostMessageResponse` returns `{message_id, run_id, model, provider}`
(`api.ts:302-312`) where `run_id` is the **producer `runs`** row. `threads.active_workflow_run_id` is the
**`workflow_runs`** row. Different tables (`runs.run_id` vs `workflow_runs.id`), and the sub-agent FK
(`runs.parent_run_id`) points at the *producer* one — which is exactly why `_build_phase_tool_context`
raises rather than falling back (`phase_types.py:373-375`).

**Therefore:** D-188-11's primary path works as written. `doRun` calls `getThreadWorkflow(thread.id)`
after `postMessage` resolves and reads `active_workflow_run_id`. The thread-id fallback is unnecessary
(though harmless as defence in depth).

---

### 3. [BLOCKING for D-188-16] What does `test_revert_byte_identical` actually assert?

**Answer: it asserts nothing about routes it does not name — so the new route passes it unchanged. The
real fence is in `test_182_canvas_gate.py`, and it is an EXACT-SET assertion.** `[VERIFIED: files read + both suites executed at db086240 — 12 passed]`

**`test_revert_byte_identical.py` (287 lines) asserts, and only asserts:**
- `GET /features` hides `visual_workflow_canvas` from everyone incl. operators, when off;
- `GET /workflows/grounding-bundle` and `POST /workflows/validate` return 404 (not 403/401/405/422) when
  off, for anonymous / bad-token / authenticated / operator callers, with body `{"detail":"Not Found"}`;
- both of those paths are actually mounted (so the 404 is not vacuous);
- four unrelated governed features are unchanged.

There is **no** route-set enumeration and **no** OpenAPI diff. A new route gated only by
`Depends(require_canvas())` **keeps this file green with zero edits.**

**⚠ But the file's own header makes an edit MANDATORY by project convention:**

> *"Each future canvas route (183+) MUST add its own '404 when off' assertion to
> `test_require_canvas_404s_when_off` (or a sibling) so the reachable-route set stays provably empty
> while off — the gate grows WITH the surface it protects."*

**The real fence — `test_182_canvas_gate.py:305-311`:**

```python
# Exactly the canvas surface moved — nothing else drifted between the two states.
assert set(on_doc["paths"]) - set(off_doc["paths"]) == set(_CANVAS_PATHS)
assert set(on_doc["components"]["schemas"]) - set(off_doc["components"]["schemas"]) == set(_CANVAS_SCHEMAS)
```

`_CANVAS_PATHS` / `_CANVAS_SCHEMAS` are **test-local literals**, deliberately not imported from
`CANVAS_GATED_PATHS` (*"a test that imports the constant it is checking would pass even if someone
emptied the constant"*). So:

| Action | `test_revert_byte_identical` | `test_182_canvas_gate` | Non-discoverability |
|---|---|---|---|
| Add the route, do **not** touch `CANVAS_GATED_PATHS` | ✅ green | ✅ green (nothing moved) | ❌ **the route + its models stay published in `/openapi.json` while the canvas is off** |
| Add the route AND `"/workflow-runs/{workflow_run_id}"` to `CANVAS_GATED_PATHS`, no test edit | ✅ green | ❌ **RED** — the set-difference gains a member | ✅ |
| Add both, AND update `_CANVAS_PATHS` + `_CANVAS_SCHEMAS` | ✅ green | ✅ green | ✅ |

**And the halves are genuinely asymmetric, exactly as CONTEXT warned:**
- **Request side** — `_is_canvas_path(path)` (`canvas_gate.py:126-137`) does exact-set membership on the
  **request** path (`/workflow-runs/9f3c…`), which can never equal a template. Adding the template is a
  no-op here. `require_canvas` is the authority, and its 404 payload is byte-identical to the
  middleware's. **Side effect worth noting:** because `_is_canvas_path` also guards
  `await _ensure_flag_fresh()`, a `/workflow-runs/*` request skips that pre-refresh — but
  `require_canvas` awaits `ensure_settings_fresh()` itself as step (0) (`dependencies.py:667`), so the
  staleness bound still holds. No gap.
- **Schema side** — `canvas_filtered_openapi` (`canvas_gate.py:253`) does `paths.pop(p) for p in
  CANVAS_GATED_PATHS`, and FastAPI's `paths` keys are **templates**. Adding the template is
  load-bearing here and nowhere else.

**Recommendation (all three, one commit — which is what `canvas_gate.py:55-58`'s own instruction says):**
1. Add `"/workflow-runs/{workflow_run_id}"` to `CANVAS_GATED_PATHS`.
2. Update `_CANVAS_PATHS` and `_CANVAS_SCHEMAS` in `test_182_canvas_gate.py` (read the models that
   actually move from the assertion's own failure output — see A5).
3. Add a 404-when-off probe for the new route to `test_revert_byte_identical.py`.

---

### 4. [BLOCKING for D-188-22] During a LIVE run, is `workflow_phases` fully populated?

**Answer: YES — every row for the whole run exists from run creation, all `status='pending'`. The
premise that rows are inserted as phases start is FALSE.** `[VERIFIED: db/workflows.py:190-218 + a repo-wide grep for INSERT INTO workflow_phases]`

```python
# backend/app/db/workflows.py:206-214 — inside create_workflow_run's single transaction
for ps in sorted(definition.phases, key=lambda p: p.phase_index):
    await con.execute(
        "INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status) "
        "VALUES ($1, $2, $3, 'pending')",
        run_id, ps.phase_index, ps.slug,
    )
```

Its docstring names itself *"the ONLY live-app path that creates a workflow run … no `INSERT INTO
workflow_phases` existed anywhere in `backend/app` before this"*, and a grep across `backend/app`
confirms it is still the only INSERT; every other reference is an `UPDATE … SET status=` or a SELECT.

**And `GET /threads/{id}/workflow` returns them all, live and terminal** (`threads.py:1191-1235`):
`phases_source_run_id = active_workflow_run_id` first, `ORDER BY phase_index`, returning
`slug + phase_index + status + phase_type` — the `phase_type` derived from the definition JSON, so it is
**not** null mid-run either. `total_phases` in the same response is
`(SELECT count(*) FROM workflow_phases WHERE workflow_run_id = wr.id)` (`threads.py:1100-1101`), i.e.
**identical to `len(phases)` whenever the anchor is set.**

**Consequences that make D-188-22b cheaper and stronger than planned:**

1. The live branch's placeholder skeleton is **entirely redundant**. `wf.phases` already carries real
   slugs, real per-phase statuses and real phase types for every position.
2. The overlay is **complete, not partial** — the "keep the `total_phases` floor for rows the harness has
   not inserted yet" clause in D-188-22 describes a case that cannot occur. (Keeping the floor as a
   defensive `?? total` is still fine; just do not present it as load-bearing.)
3. The live branch also loses `phaseType` (`"unknown"`) today — a second, unrecorded half of the same
   bug. Overlaying `wf.phases` fixes both in one edit.
4. **A caution:** the live branch's *derived* statuses (`i < current ? done : i === current ? running :
   pending`) are a forward-only floor and are in some cases MORE advanced than the DB rows (the DB row
   only flips at `complete_phase`). Overlay the **slug and phase_type** unconditionally; be deliberate
   about whether the **status** is overlaid too, because a naive full overlay could move the counter
   backward and break the shipped forward-only invariant (`PhaseTimeline.tsx:115-127`). **Recommended:
   overlay identity (slug, phaseType) only; leave the status derivation alone.** That closes
   BUG-260609-04 without touching the floor semantics at all.

---

### 5. Can `frame.run_status` ever be `timed_out`?

**Answer: NO. It is definitively dead. D-188-21's deferral can be closed with evidence.** `[VERIFIED: threads.py read exhaustively + full-schema.sql CHECK constraint]`

- `PhaseTimeline` reads `frame?.run_status` where `frame` is `ThreadWorkflowState` from
  `getThreadWorkflow(threadId)` (`PhaseTimeline.tsx:86-106, 129`).
- In `threads.py`, `run_status` is initialised `None` at `:1083` and assigned in **exactly one place**,
  `:1110`: `run_status = wf_row["status"]`, where `wf_row` comes from a `SELECT wr.status … FROM
  workflow_runs wr … WHERE wr.id = $1`. A grep for `run_status` in the file returns 7 hits: the init,
  that one assignment, four read sites, and the response field. **There is no Deep-`runs`-row path.**
- The Deep producer row IS read nearby — `prod_row = SELECT run_id, status FROM runs …` at `:1145-1149` —
  but its status feeds only the local `producer_terminal` boolean (which sets `lock_is_stale`) and
  `latest_producer_run_id`. It never reaches `run_status`. *(That local check is where `"timed_out"`
  legitimately appears, at `:1151-1153` — which is almost certainly how the value got copied into
  `TERMINAL_RUN_STATUSES` in the first place.)*
- `workflow_runs_status_check` = `active | paused | cap_paused | completed | failed | cancelled`
  (`full-schema.sql`, measured). No `timed_out`.

**Recommendation:** carry `timed_out` forward **as D-188-21 instructs** (the decision is locked and
harmless), but record this measurement in the plan so the deferral's re-open trigger — *"someone measures
it"* — is satisfied and the next phase can retire it in one line. If the planner prefers to act now, the
honest framing is: it is dead code in a set that is being MOVED anyway, and removing it during the move
costs nothing. Either way, **the claim is no longer unmeasured.**

---

### 6. Where should the shared phase-state module live, without an ESM cycle?

**Answer: `frontend/src/lib/phaseState.ts`.** `[VERIFIED: import-graph read at db086240]`

The measured constraint set:

| Consumer | Lives in | Currently imports |
|---|---|---|
| `StreamsProvider.tsx` | `providers/` | `@/hooks/usePanelReconcile`, `@/lib/api`, `@/types`, `@/stores/streamsStore` |
| `PhaseCard.tsx` / `PhaseTimeline.tsx` | `components/panel/` | `@/lib/cn`, `@/lib/phaseGlyph`, `@/lib/providerLogo`, `@/types`, `@/providers/StreamsProvider` |
| `PhaseNode.tsx` / `PhaseNodeCard.tsx` | `components/workflows/` | `@/components/workflows/*`, `@/lib/utils` |
| `WorkflowRunPage.tsx` (new) | `pages/` | — |

`frontend/src/lib/` already hosts exactly this shape — `phaseGlyph.tsx`, `stepCount.ts`,
`workspacePanel.ts`, `toolMeta.ts` are all leaf modules consumed by both `components/panel/*` and
`components/workflows/*`. **A cycle is impossible by construction** if `phaseState.ts` imports only
`@/types` (which imports nothing from the app). No `lib/*` module imports a component today, and this one
must not become the first.

**On the `WorkflowCanvas` ↔ `FlowEdge` cycle constraint:** it is real and it is documented in
`WorkflowCanvas.tsx:25-32` (`edgeTypes = { flow: FlowEdge }` is a module-scope VALUE import). But it does
**not** constrain `phaseState.ts` at all, because neither `WorkflowCanvas` nor `FlowEdge` needs to import
it — the run reading arrives on `node.data` as an opaque value, and the *page* does the derivation.
The constraint would only bite if a future extraction lifted something *out of* `WorkflowCanvas` into a
module that `FlowEdge` also imports. That is the deferred `PlaneEditingLayer` work, not this.

**Do NOT site it in `components/workflows/`** even though `nodePresentation.ts` and `phaseVocabulary.ts`
live there: importing a `components/workflows/*` module from `components/panel/*` inverts the existing
dependency direction (panel → workflows does not exist today) and would make the developer panel depend
on the canvas tree.

---

### 7. What is a realistic `git diff --numstat` cap for `WorkflowCanvas.tsx`?

**Answer: recommend `≤ 15 insertions / ≤ 4 deletions`. CONTEXT's proposed ≤ 25/≤ 5 is achievable with
headroom; ≤ 15/≤ 4 is defensible and tighter.** `[VERIFIED: file read; the `marks` prop measured as the precedent]`

The file is **1,582 lines** at HEAD (measured — matches the ledger). The minimum surface, itemised
against the shipped `marks` precedent:

| Change | Site | Insertions | Deletions |
|---|---|---|---|
| Type import (fold into an existing import block) | ~:77-93 | 1 | 0 |
| `runState?:` prop + docblock (the `marks?:` precedent at `:801-807` is **5 comment lines + 1 declaration = 6**) | ~:807 | 6 | 0 |
| Destructure one identifier | ~:873 | 1 | 0 |
| `data: {...}` merge — one line rewritten | :952 | 1 | 1 |
| memo dependency array — one line rewritten | :955 | 1 | 1 |
| **Total (exact mirror of `marks`)** | | **10** | **2** |

Headroom of 5 insertions / 2 deletions covers a house-style docblock that runs longer than the precedent,
or a `data-run-state` attribute if the acceptance test needs a canvas-level hook.

**What must NOT be inside the cap** (and is what makes the cap honest rather than decorative):
- the `phase_index` → `slug` join → **the page**;
- the reading vocabulary → **`runVocabulary.ts`**;
- the ring SVG → **`PhaseNodeCard.tsx`**;
- the `usePhases` subscription → **the page** (also required by the 067.5 Branch-D3 guard).

**Precedent for the discipline:** `187-08` pinned ≤ 7 / ≤ 2; Phase 185 honoured G-5 on
`PhaseFormPanel.tsx` at a measured 23 ins / 6 del of which only **4 reached the render body**. Measure
with `git diff --numstat -- frontend/src/components/workflows/WorkflowCanvas.tsx` and pin the number as a
plan acceptance criterion, exactly as 187-08 did.

---

### 8. How does the frontend test harness pin counts?

**Answer: two independent knobs, and a new file lands outside BOTH unless it is inside
`src/components/workflows/`.** `[VERIFIED: script read + executed at db086240]`

Gate: `node scripts/vitest-count-gate.cjs`. **Measured run, 2026-08-05:**

```
total 2196  ·  failed 0  ·  pinned total 946
count gate OK — 22/22 pinned files present, no per-file decrease, 0 failing.
```

| Knob | What it controls | Current contents (relevant) |
|---|---|---|
| `TARGETS` (`:193-213`) | what **RUNS** | `src/components/workflows` *(directory)*, `src/pages/WorkflowBuilderPage.{test,canvas.test,header.test,describe.test}.tsx`, `src/components/admin/revertByteIdentical.test.tsx` |
| `BASELINE` (`:92-188`) | what is **PINNED** (per-file floor + the summed `BASELINE_TOTAL` = 946) | 22 files |

**What a Phase-188 test file must do:**

| New file | Runs today? | Pinned today? | Required action |
|---|---|---|---|
| `components/workflows/*.test.tsx` | ✅ (directory entry) | ❌ | add to `BASELINE` |
| `lib/phaseState.test.ts` | ❌ | ❌ | add to **both** `TARGETS` and `BASELINE` |
| `components/panel/__tests__/*.test.tsx` (incl. the **existing** `PhaseTimeline.test.tsx` / `PhaseReconcile.test.tsx`) | ❌ | ❌ | add to **both** if 188 relies on them |
| `pages/WorkflowRunPage.test.tsx` | ❌ | ❌ | add to **both** |

**Two measured slack hazards the plan should close while it is here:**
- `WorkflowCanvas.test.tsx` is pinned at **31** but runs **35** — 4 cases sit in slack and are deletable
  with the gate green.
- `PhaseNode.test.tsx` (13) and `PhaseNodeCard.test.tsx` (68) **run but are entirely unpinned** — and
  they are the two files that will carry 188's node-level guards. This is verbatim the round-5
  "verification truth 14" failure the script's own comments describe.

**Pin values MUST be read from the script's own printed `actual` column, never hand-counted** — the
script's header explains why (`definitionOps.test.ts` declares ~122 `it(` literals and runs 232 cases
under `it.each`; a pin below the real count can never fire). The convention is two agreeing runs, then
one observed deletion catching `[count-decrease]`.

**Typecheck, re-measured:** `npx tsc --noEmit` in `frontend/` checks **zero** files (the root
`tsconfig.json` is `{"files": [], "references": […]}`). The real command is
`npx tsc --noEmit -p tsconfig.app.json`, which reports **33 pre-existing errors** at HEAD
`[VERIFIED: executed 2026-08-05, count = 33]`. Any gate must be *"still 33"*, never *"zero"*.

---

### 9. Is the deliverable reachable from the run surface?

**Answer: YES, with zero net-new backend work — but `FilesSection` cannot be reused as-is.** `[VERIFIED: code read at db086240]`

**Reachable:** `GET /threads/{thread_id}/workspace/files` (`workspace.py:310-333`, router prefix
`/threads/{thread_id}/workspace`) is gated by `_verify_thread_ownership` → 404 on a miss, and RLS on top.
It has **no run-state condition** — a terminal run's thread lists its files exactly as a live one does.
It returns `id, path, size_bytes, mime_type, created_at, updated_at, kind, expires_at`, ordered by path,
with expired template rows excluded.

**Client helpers, both already thread-parameterised:**
- `useWorkspaceFiles(threadId)` — `StreamsProvider.tsx:3216`, backed by `usePanelReconcile`.
- `downloadWorkspaceFile(threadId, fileId, filename)` — used by `FilePreview.tsx:203`, Bearer-authed
  raw-bytes route (`/files/{id}/raw`, `workspace.py:431`).

**⚠ The one integration cost:** `FilesSection` reads the thread from
`useViewingThread()` (`FilesSection.tsx:103`), **not** from a prop. Reusing it on the run surface would
require either setting the globally-viewed thread (a side effect on chat state — undesirable) or adding
an optional `threadId` prop defaulting to `useViewingThread()` (additive, ~2 lines). Recommend the
latter, or simply have `WorkflowRunPage` call `useWorkspaceFiles(run.thread_id)` and render its own
compact list — the run surface wants a different, terser presentation than the panel section anyway.

**`.docx` is download-only, confirmed in code.** `FilePreview` fetches `/content`; when the content
fetch errors or returns nothing usable it renders `<Fallback message="No preview available · Download"
onDownload={…} />` (`FilePreview.tsx:262-268`). `references/approval-and-review.md` records the matrix:
DOCX / PPTX / XLSX / PDF → download-only. `render_template` (docxtpl) produces `.docx`. **Req 7 asks for
"listed and downloadable", which is exactly what ships. Do not promise a preview.**

**Free win worth copying:** `StreamsProvider.tsx:1044-1046` already refetches the workspace files on a
successful `run_completed` (the Phase 101.1-09 gap-4 fix — the deliverable's row often does not exist yet
when the panel last fetched). The run surface should benefit from this automatically if it uses
`useWorkspaceFiles(run.thread_id)`; **verify that the refetch is keyed on the run's thread, not the
viewed thread**, or the file list on the run surface will read "No files yet" until a manual refresh.

---

### 10. Backend test-suite reality — re-measured

**Answer: 211 failed / 3296 passed, deterministic across two runs.** `[VERIFIED: executed twice at
db086240, `pytest tests/ -q -p no:randomly`]`

> ⚠ **Corrected by the orchestrator, 2026-08-05.** This section originally concluded *"the memory figure
> of ~62-red is REFUTED"*. That is wrong — it compares **two different scopes**. The 62-red figure was
> `pytest tests/unit -q` (62 failed / 1700 passed, measured at Phase 187 round 5); the 211 figure below
> is the whole `tests/` tree. A subset at 62-red and its superset at 211-red are **consistent**, so
> nothing is refuted. **Use 211 as the full-suite non-attribution baseline** — that part stands — but do
> not conclude the `tests/unit` async-mock rot was imagined, and do not repeat "REFUTED" downstream.

```
3541 tests collected in 5.11s          (0 collection errors)
211 failed, 3296 passed, 19 skipped, 5 xfailed, 9 xpassed, 1 error in 347.51s   (run 1)
211 failed, 3296 passed, 19 skipped, 5 xfailed, 9 xpassed, 1 error in 305.97s   (run 2, --tb=no)
```

Failures span ~50 files; the largest clusters are `test_skill_tuner_routes.py` (16),
`test_retrieval_service.py` (15), `test_dual_mode_wiring.py` (15), `test_sql_service.py` (12),
`test_threads_skills.py` (11) — all async-mock rot in files this phase does not touch.

**What matters for THIS phase — measured individually:**

| Suite | Status at HEAD | Consequence |
|---|---|---|
| `test_revert_byte_identical.py` + `test_182_canvas_gate.py` | ✅ **12 passed** in isolation | **A usable, honest gate.** The SPEC's byte-identity acceptance criterion can be asserted for real. |
| `test_thread_workflow_endpoint.py` | ❌ **1 of 7 red** — `test_thread_workflow_state_shape` asserts `body["locked"] is True`, gets `False` | The suite fencing the endpoint the run surface reads is **not** fully green. Do not quote it as a backstop; state the 1-red and, if the phase touches that response, fix or explicitly carry it. |
| `test_181_flip_on.py::test_canvas_ping_200_after_flip_on` | ❌ red in isolation | Pre-existing; unrelated to the new route but in the same canvas-gate family. Record it so a 188 change is not blamed for it. |
| `test_182_grounding_bundle.py` | ❌ 2 red in isolation | Same — pre-existing, record it. |

**Recommended honest gate for the plan:** *"the four canvas/gate suites named above are run before and
after; `test_revert_byte_identical.py` + `test_182_canvas_gate.py` must be GREEN (they are today);
`test_181_flip_on.py` and `test_182_grounding_bundle.py` must not get WORSE than their measured 1/2 red;
the full backend suite's 211 pre-existing failures are recorded as the baseline and non-attribution is
proven by diffing the failure set, not by a rollback run."*

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Python venv (`backend/venv`) | every backend test + the SC#10 script | ✓ | 3.12 | — |
| `pytest` | route + gate tests | ✓ | collects 3541 | — |
| Node + `npx vitest` | every frontend test | ✓ | gate ran clean | — |
| `node scripts/vitest-count-gate.cjs` | the pin gate | ✓ | OK, 2196/946 | — |
| `npx tsc -p tsconfig.app.json` | typecheck | ✓ | 33 pre-existing errors | — |
| Local Supabase (`:54322`) | UAT evidence + the SC#10 verdict reads | not probed this session | — | `psycopg2` per `reference_evidence_tools_inventory`; falls back to backend logs |
| Redis (docker-compose.dev) | any live run at all | not probed this session | — | none — a live run cannot happen without it |
| **A configured API key per provider** | **the 8-row SC#10 board** | **UNKNOWN — must be checked before the board is authored** | — | ⛔ the row, with reason `"no API key configured for <provider>"` and the blocking id |

**Missing dependencies with no fallback:** none identified for the code work.

**Missing dependencies with fallback:** the SC#10 provider keys. ⚠ **This is the single most important
environment item**, because `override_provider` returns the settings **unchanged** when the target
provider has no `api_key` (`user_settings.py:960-961`) — a row for an unconfigured provider will silently
run on the previous provider and *look like a pass*. The board must read `runs.provider` back and record
a mismatch as ⛔, never as a pass. Probe first:

```sql
-- or read the providers array off the effective settings
SELECT key FROM app_settings WHERE key LIKE '%api_key%';
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Frontend framework | `vitest` + `@testing-library/react` (+ `vitest-axe` where a11y applies) |
| Frontend config | `frontend/vitest.config.*` (in tree); **the gate** is `scripts/vitest-count-gate.cjs` |
| Backend framework | `pytest` (`backend/venv`), `TestClient` + `monkeypatch` |
| Quick run command | `node scripts/vitest-count-gate.cjs` — measured 2196 tests / 0 failing / ~2 min |
| Full frontend suite | `cd frontend && npx vitest run` — ⚠ carries pre-existing rot outside the gate's blast radius (A4, not re-measured) |
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — must remain **33**, not 0 |
| Backend quick | `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py tests/test_188_workflow_run_read.py -q` |
| Backend full | `… -m pytest tests/ -q -p no:randomly` — **baseline 211 failed / 3296 passed** (measured twice) |

### Phase Requirements → Test Map

| Req | Behaviour to prove | Type | Automated command | File exists? |
|---|---|---|---|---|
| REQ-1 | Canvas and `PhaseTimeline` resolve every phase's state from the same source value over a fixture run | unit (parity) | `npx vitest run src/lib/phaseState.test.ts` | ❌ Wave 0 |
| REQ-1 | The ⛨ seal renders identically at **all seven** readings (D-188-04) | render | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` | ✅ exists (68 cases, **unpinned**) |
| REQ-2 | Zero raw DB status literals and zero `phase_index` in the canvas run-state render path; no slug text with ⌥ off | source grep + render | `npx vitest run src/components/workflows/PhaseNode.test.tsx` | ✅ exists (13 cases, **unpinned**) |
| REQ-3 | An unrecognised status renders **unknown**, not done — **observed RED against `?? "done"` first** | unit | `npx vitest run src/lib/phaseState.test.ts` | ❌ Wave 0 |
| REQ-3 (⚠ new) | A `pending` phase at successful run completion does **not** become `done` — **observed RED against the shipped sweep first** | unit (store) | `npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx` | ✅ exists, **outside TARGETS** |
| REQ-4 | Paintable readings ⊆ reconcilable readings (no `retrying`) | unit (property) | `npx vitest run src/lib/phaseState.test.ts` | ❌ Wave 0 |
| REQ-4 | A mid-run `reconcile()` leaves every visible node reading identical | integration (RTL) | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ❌ Wave 0 |
| REQ-5 | The run-time waiting string ≠ `Waits for you`, and not a tense variant | render + grep | `npx vitest run src/components/workflows/PhaseNode.test.tsx` | ✅ exists |
| REQ-6 | Launching does not navigate to chat; the surface renders no message list and no composer | integration | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ❌ Wave 0 |
| REQ-6 | The thread is still created and still anchors the run | integration (wire) | same file — assert `createThread` + `postMessage` called, `onNavigate` arg is `"workflow-run"` | ❌ Wave 0 |
| REQ-7 | A terminal run re-opens by id with no live stream and renders its spine + final state | integration | same file | ❌ Wave 0 |
| REQ-7 | The deliverable is listed and downloadable | integration | same file (mock `useWorkspaceFiles` + `downloadWorkspaceFile`) | ❌ Wave 0 |
| REQ-7 | Any elapsed figure is labelled with the field it derives from; `claimed_at = null` shows no clock | render | same file | ❌ Wave 0 |
| REQ-8 | Both views import the derivation from one module (grep: zero local re-derivations) | source grep | `npx vitest run src/lib/phaseState.test.ts` (a `FORBIDDEN_SYMBOLS` fence, the `DescribeKbPicker.test.tsx` pattern) | ❌ Wave 0 |
| REQ-8 | `WorkflowCanvas.tsx` diff within cap | shell | `git diff --numstat -- frontend/src/components/workflows/WorkflowCanvas.tsx` | n/a — plan acceptance criterion |
| SPEC | `visual_workflow_canvas` off ⇒ byte-identical; the new route 404s | backend | `pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py -q` | ✅ exists (**12 pass today**) |
| SPEC | Zero migration files added | shell | `git diff --name-only HEAD -- supabase/migrations/` is empty | n/a |
| SC#10 | 8 rows, each PASS or ⛔-with-reason | manual/script + DB read | `scripts/` script (see Open Question 1) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node scripts/vitest-count-gate.cjs` (~2 min) + `npx tsc --noEmit -p tsconfig.app.json` (expect 33).
- **Per wave merge:** the above, plus the four canvas/gate backend suites.
- **Phase gate:** full backend suite once, diffed against the recorded 211-failure baseline; full count gate green with every new pin present; the two falsification RED observations pasted verbatim into the plan summary; the 8-row SC#10 board complete (⛔ allowed, silent omission not).

### Nyquist justification — what must be sampled, at what granularity

The phase's failure modes are all **disagreements between two observers of one fact**, so the sampling
rate must be at least twice the rate at which the fact changes:

| Failure mode (from G-6) | Highest-frequency observable | Required sample |
|---|---|---|
| #1 canvas vs panel disagree | every phase transition (~seconds) | a **pure-function** parity assertion, not a UI snapshot — one call per status value covers every transition by construction |
| #2 a step that never ran shows Complete | once per run, at the terminal edge | one store-level test driving `run_completed` with a `pending` row present — **the Pitfall-1 test** |
| #3 refresh changes a reading | once per reload | before/after `reconcile()` equality over the rendered readings |
| #4 will-wait vs is-waiting indistinguishable | once per `llm_human_input` phase | a string-inequality + tense assertion; static |
| #5 launch lands in chat / composer appears | once per launch | one integration test; structural (the else-branch has no composer) |
| #6 finished run unreachable / deliverable unreachable | once per run, a day later | terminal-run render test with no stream + a files-list assertion |
| #7 unanchored clock | continuous while live | render assertion on the label, plus the `claimed_at = null` case |
| #8 byte-identity broken | once per deploy | the two backend gate suites |
| #9 cap exceeded | once per commit to that file | `git diff --numstat` |
| #10 a migration appears | once per commit | `git diff --name-only` |

**The two highest-value samples are #2 and #3**, because they are the only ones where the product
currently produces a *wrong* reading rather than a *missing* one — and both are cheap store-level tests.

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` ⇒ enabled.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control (shipped) |
|---|---|---|
| V2 Authentication | yes | `require_canvas()` validates the bearer token itself and publishes the identity on `request.state.canvas_caller` (WR-08). The handler consumes `Depends(canvas_caller)` — **never** a second `get_current_user`. |
| V3 Session management | no | No session state is created; the run surface is a client view over existing auth. |
| V4 Access control | **yes — the primary control for this phase** | The new route MUST ownership-gate `workflow_runs` and 404 on a miss. `workflow_runs` carries `user_id` and `org_id`; RLS applies to the user-JWT client. The IDOR shape is *"guess a run uuid, read someone's definition + phase spine"*. Precedent: `threads.py`'s "ownership-gated FIRST (T-092-04 — 404, never leak existence)". |
| V5 Input validation | yes | `workflow_run_id: UUID` in the signature ⇒ FastAPI 422 on a malformed id for free. ⚠ **But note the D-182-R2-01 lesson: FastAPI decodes the body/params before dependencies run**, which is exactly why the request-side flag gate was moved into middleware. For a **GET with no body** this is not exploitable (the path-param 422 does not reveal a handler any more than the 404 does) — but a plan that adds a POST to this router inherits the problem. |
| V6 Cryptography | no | Nothing cryptographic is introduced. |
| V7 Error handling / logging | yes | The 404 payload must be byte-identical to an unbuilt path: `{"detail": "Not Found"}`, no custom message, no extra headers, no `WWW-Authenticate` (`canvas_gate.py:166-171` documents the contract). |
| V13 API / web service | yes | The route must appear in `CANVAS_GATED_PATHS` for the OpenAPI-strip half, or the schema publishes a map of a surface the 404 is hiding (Open Question 3). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation (and where it already lives) |
|---|---|---|
| IDOR on a guessed `workflow_run_id` | Information disclosure | Owner-scoped SELECT + 404-on-miss; never 403, never 200-with-empty. |
| Route-existence disclosure via 403/401/405/422 | Information disclosure | `require_canvas` resolves the flag **before** auth and folds anonymous/invalid/banned into the same 404 (CR-01, `dependencies.py:670-681`). Do not stack `require_visible`. |
| Route-existence disclosure via `/openapi.json` | Information disclosure | `canvas_filtered_openapi` — requires the **path template** in `CANVAS_GATED_PATHS` (Open Question 3). Anonymous + unconditional endpoint; this is the half that is easy to forget. |
| Stale feature flag on a non-writing worker | Elevation of privilege | `require_canvas` awaits `ensure_settings_fresh()` as its step (0) — TTL-bounded, non-raising, fail-closed. Inherited for free. |
| Cross-org read of a shared definition | Information disclosure | `workflow_runs.org_id` + the v3.4 membership RLS. The route should read through the **user-JWT** client (`get_user_supabase_client`), not the service-role client, so RLS is the belt to the ownership check's braces. |
| Reflected authored strings (workflow / phase names) on the run surface | Tampering / XSS | Every authored string renders as a plain React text child or a `title=` value — **never** `dangerouslySetInnerHTML` (T-124-01; `PhaseNode.tsx:65-71` carries the house grep guard clause verbatim). The run surface must carry the same discipline. |

---

## Sources

### Primary (HIGH confidence — read or executed at `db086240`, 2026-08-05)

- `backend/app/api/threads.py` — `send_message` (`:820-1026`), `get_thread_workflow` (`:1040-1262`)
- `backend/app/db/workflows.py:141-219` — `create_workflow_run` (the only `workflow_phases` INSERT)
- `backend/app/services/workflow_kickoff.py:330-460` — `build_harness_run_context`
- `backend/app/services/sub_agent_models.py:150-259` — `resolve_sub_agent_model_safely` / `resolve_workflow_ctx_model`
- `backend/app/services/harness/phase_types.py:350-352` — `_effective_model`
- `backend/app/services/task_service.py:250-310, 539-600` — provider routing + the sub-agent `runs` row
- `backend/app/services/harness_engine.py:1561-1585` — the `skip_to_phase` cursor jump
- `backend/app/services/run_model_resolution.py` (whole file) — `resolve_run_model`
- `backend/app/models/user_settings.py:957-967` — `override_provider`
- `backend/app/config.py:743-753` + `MODEL_CAPABILITIES` — executed to derive the 8-provider roster
- `backend/app/dependencies.py:615-700` — `require_canvas` / `canvas_caller`
- `backend/app/middleware/canvas_gate.py:55-300` — both gate halves
- `backend/app/api/workflows.py:600-612` — the route precedent
- `backend/app/api/workspace.py:43-55, 305-340` — the thread-scoped files read
- `backend/tests/test_revert_byte_identical.py`, `backend/tests/test_182_canvas_gate.py` — read AND executed (12 passed)
- `supabase/full-schema.sql` — `workflow_runs`, `workflow_phases`, `workflow_definitions` CREATE TABLE + CHECK constraints
- `frontend/src/providers/StreamsProvider.tsx:1020-1046, 2811-2830, 3280-3365` — the sweep, `reconcilePhases`, `usePhases`
- `frontend/src/hooks/usePanelReconcile.ts:1-90` — the D-086-15 exclusion
- `frontend/src/components/panel/{PhaseCard,PhaseTimeline,FilesSection,FilePreview}.tsx`
- `frontend/src/components/workflows/{WorkflowCanvas,PhaseNode,PhaseNodeCard,canvasModel,nodePresentation}.tsx|ts`
- `frontend/src/components/layout/ChatLayout.tsx:230-268, 536-650`, `frontend/src/App.tsx:91`
- `frontend/src/types/index.ts:1010-1025`, `frontend/src/lib/api.ts:298-312, 1096-1200, 1250-1305`
- `scripts/vitest-count-gate.cjs` — read AND executed
- `.planning/phases/188-non-technical-run-observability/188-SPEC.md`, `188-CONTEXT.md`
- `.planning/sketches/{152,153,154}/README.md`
- `.claude/skills/sketch-findings-agentic-rag/references/{run-state-honesty,icon-convention,app-information-architecture,graded-governance,approval-and-review,workflow-run-surface}.md`
- `.planning/reported-bugs/BUG-260609-04.md`
- `CLAUDE.md` (project instructions)

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` §Phase 188 + line 556 (the G-5 note) — planning intent, not code
- `.planning/REQUIREMENTS.md:48-50, 118-120` — RUNVIZ-01/02/03

### Tertiary (LOW confidence — flagged, not relied on)

- Session memory's *"backend unit suite is ~62-red"* — **NOT refuted; a different scope.** That figure was `pytest tests/unit -q` (62 failed / 1700 passed, Phase 187 round 5); the 211 figure here is the whole `tests/` tree. A subset at 62-red and its superset at 211-red are consistent. Corrected by the orchestrator 2026-08-05 — the original "REFUTED" wording in this document is wrong.
- Session memory's *"frontend vitest rot ~14-17"* — not re-measured this session (A4). The count gate's blast radius **was** measured and is 0-failing.
- `graphify query` — **unavailable this session**: `graphify query "…"` crashes with `UnicodeEncodeError: 'charmap' codec can't encode character '→'` on this Windows console. `graphify-out/graph.json` exists; the CLI read path is broken under cp1252. Recorded as an environment note; no research conclusion depends on it.

---

## Project Constraints (from CLAUDE.md)

Directives extracted verbatim in intent; the planner must verify compliance.

| Directive | Bearing on Phase 188 |
|---|---|
| Python backend must use a `venv` | All backend commands in this document use `backend/venv/Scripts/python.exe`. |
| No LangChain / LangGraph — raw SDK calls only | Not touched. |
| Pydantic for structured outputs | The new route's `response_model` is a Pydantic model. |
| All tables need RLS | No new table. The new route reads through the **user-JWT** client so RLS applies. |
| Stream chat responses via SSE | Not touched — the run surface consumes the existing stream via the existing reducer. |
| **Schema changes ship as numbered SQL migrations** | ⛔ **Zero migrations** in this phase — a migration file appearing is failure condition #10. |
| **Supabase Realtime is a hint, not truth (D-v2.5-03)** | Directly binding: Req 4. ⚠ See Pitfall 3 — the reconcile-on-reconnect the rule implies is **not shipped** for `usePhases`. |
| No blocking I/O in async handlers — wrap with `run_in_threadpool` | The new route must use `aexec(...)` / asyncpg, not a bare `supabase-py` call. |
| Multi-worker uvicorn is the default (`WORKER_COUNT=2`) | The flag read is per-worker cached; `require_canvas` bounds staleness itself. Do not add a module-level cache to the new route. |
| Settings live in `user_settings` / `app_settings` | `visual_workflow_canvas` is an `app_settings` feature-visibility record — already exists; no env var. |
| **Provider-docs-first (evidence-based)** | Bears on SC#10 only. This phase changes no provider handling; each row asserts terminal-state + canvas paint (D-188-25), not emit quality. **The provider-specific finding that DOES matter is Open Question 1's OpenRouter risk** — `native_tools: False` for all 9 OpenRouter ids, and an empty `_SUB_AGENT_MODEL_DEFAULTS` entry. |
| **Deployment-artifact parity (same-commit rule)** | ✅ Nothing this phase adds is an env var, a seed migration, a bundled service or the sandbox tag → `scripts/check-deploy-drift.sh` has nothing to reconcile. Confirm at plan time. |
| **G-1 phase chain cap** | Does not fire — 188 is not an `<base>.N` insert. |
| **G-2 sketch before plan for UX** | ✅ satisfied 2026-08-05 by sketches 152-154 (`93bbfc87`). |
| **G-3 lightweight commands for small work** | Does not fire — multi-file, new route, new surface. |
| **G-4 lived-experience UAT gate** | **FIRES** — user-visible UI. Operator-defined "I'd recognise failure here" scenarios must be set at scope time; the G-6 list in CONTEXT §H is the candidate set. Chrome MCP drives 3 at verification. |
| **G-5 refactor between feature waves** | **FIRES on `WorkflowCanvas.tsx`** (9 plans / 3 phases / 1,582 L — line count re-measured, matches the ledger). Honoured by *(a)* performing the shared-phase-state extraction the ledger's own 188 row names and *(b)* a pinned diff cap — **≤ 15 ins / ≤ 4 del recommended** (Open Question 7). The `PlaneEditingLayer` lift stays OWED and must be re-stated in the ledger as due at the next `WorkflowCanvas` feature touch. |
| **G-6 failure criteria upfront** | ✅ satisfied — `188-CONTEXT.md § H`, 10 conditions, mapped one-for-one in Validation Architecture. |
| **G-7 gap-closure round cap** | Not yet applicable (no rounds run). At the first `gaps_found`, run `node scripts/check-gap-closure-rounds.cjs 188` before emitting any `--gaps` routing. |
| **UAT scoreboard recipe — full native roster + OpenRouter, derived not transcribed** | Roster derived by execution (Open Question 1). ⚠ **The cheap per-request method carries the PROVIDER but not the MODEL** — state this in the scoreboard rather than absorbing it. A row may be ⛔ with reason; never silently omitted. |
| **Reported-bugs cross-check at `/gsd:plan-phase`** | `BUG-260609-04` carries `folded_into: "188"` — **the plan MUST contain at least one task that addresses it**, or the report's status must be reverted. Research finding: the fix is *cheaper and more complete* than the report assumed (Open Question 4). |
| **Hot-file ledger** | `WorkflowCanvas.tsx` (G-5 fires, capped) · `backend/app/api/threads.py` (**G-5 fires — extraction due**; this phase should touch it **not at all**, which the extra `getThreadWorkflow` fetch in `doRun` achieves) · `PhaseNodeCard.tsx` (watch — under threshold; two invariants are type/test-enforced: **a third badge is a typecheck error**, **no focusable control inside the card**). |

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack | **HIGH** | No packages added; every library named was read in the tree at HEAD. |
| Backend data model + route posture | **HIGH** | Schema CHECK constraints read from `full-schema.sql`; the route precedent read verbatim; both gate suites executed. |
| The two fail-opens (Pitfalls 1 & 2) | **HIGH** | Both code sites read; the `skip_to_phase` reachability path traced to `harness_engine.py:1561-1563`; the DB CHECK constraint confirms `pending` is a valid resting state. |
| Reconcile semantics (Pitfall 3) | **HIGH** | The exclusion is stated in `usePanelReconcile`'s own docblock and confirmed by a repo-wide grep for `reconcile()`. |
| SC#10 provider/model reachability | **HIGH** for the trace; **MEDIUM** for the predicted effective model | The ten-step chain was read end to end. The *predicted* model depends on the operator's saved `llm_model` being cross-provider (A1) and on no `phase.config.model` in the fixture — both stated, both cheaply verifiable at run time from `runs.model`. |
| `WorkflowCanvas` diff cap | **HIGH** | Itemised against the shipped `marks` prop, whose docblock+declaration was counted line by line. |
| Test-harness semantics | **HIGH** | Gate script read AND executed; `tsc` executed; backend suite executed twice with identical totals. |
| Elapsed-anchor semantics (`claimed_at`) | **MEDIUM** | The column's absence/presence is measured; the *meaning* of a null `claimed_at` is inferred, not read from the claim writer (A3). |
| OpenAPI-filter collateral (which models move) | **MEDIUM** | The algorithm was read and is sound; the specific model set depends on `WorkflowDefinition`'s other referents (A5). The test's own failure output resolves it in one run. |

**Research date:** 2026-08-05
**Valid until:** 2026-09-04 (30 days) — but **invalidated immediately** by any commit touching
`StreamsProvider.tsx`, `WorkflowCanvas.tsx`, `threads.py`, `canvas_gate.py`, `sub_agent_models.py`, or
`scripts/vitest-count-gate.cjs`. Re-measure the specific claim rather than re-reading this document.

---

*Phase: 188-non-technical-run-observability*
*Research completed: 2026-08-05 against `db086240`*
*Every line number, count and behavioural claim above was executed or read in this session. Where a
prior document's figure differed, the difference is recorded under § State of the Art rather than
silently corrected.*
