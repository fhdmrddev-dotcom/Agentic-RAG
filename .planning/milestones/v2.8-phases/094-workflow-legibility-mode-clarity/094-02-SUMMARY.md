---
phase: 094-workflow-legibility-mode-clarity
plan: 02
subsystem: ui
tags: [react, zustand, sse, streams-provider, panel, harness, phase-timeline, vitest, panel-09]

# Dependency graph
requires:
  - phase: 094-01-token-wave0-scaffolds
    provides: "the shared DATA-CONTRACT §7 wire fixtures module (frontend/src/test-fixtures/harness094.ts) replayed verbatim + the RED phaseHooks.test.tsx scaffold (INV-1/INV-5 it.todo) flipped GREEN here"
  - phase: 092-dual-mode-wiring-continue-button
    provides: "the workflowLockByThread slice + makeStreamCallbacks panel-default convention + usePanelReconcile + getThreadWorkflow (ThreadWorkflowState reconcile) this plan mirrors and reuses"
  - phase: 086-streamsprovider-demux
    provides: "the tasksByThread per-thread Map triad (interface/default/no-op-stub) + the new Map(prev) copy-then-mutate action-body shape + the useTasks selector + the PANEL-09 useThreadMessages boundary"
provides:
  - "the panel-only phasesByThread: Map<threadId, Phase[]> store slice — the SINGLE place a harness lifecycle wire event becomes panel state"
  - "6 additive harness phase-lifecycle SSE branches in api.ts (phase_started/_completed/_transition/gate_failed/run_failed/run_completed) reading FLAT producer fields, Deep dispatch provably byte-identical (64 insertions / 0 deletions, 0 return)"
  - "the onPhase* demux defaults (OWNING-threadId-keyed) + 3 phase action bodies (append/setStatus/replace) + the usePhases(threadId) selector with a getThreadWorkflow reconcile-floor skeleton"
  - "the Phase type (DATA-CONTRACT §3b) in types/index.ts"
affects: [094-03-timeline-render, 094-05-surfacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive harness-lifecycle SSE branch: a new wire event → an else-if AFTER the Deep switch (cap_paused) carrying NO return → a panel-only callback → a dedicated per-thread Map. Every Deep branch stays byte-identical (git diff = additions-only)."
    - "Reconcile-floor adapter: usePanelReconcile<Phase> with a reconcilePhases fetcher that wraps getThreadWorkflow (ThreadWorkflowState) and derives a Phase[] skeleton (total_phases pending rows, current running) — reconcile is the FLOOR, live advances forward (D-v2.5-03)."
    - "empty-slug 'active phase' sentinel in setPhaseStatusForThread: run_failed targets the latest non-terminal phase row (the one live when the run died) without the demux needing to know the slug."

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/stores/streamsStore.ts
    - frontend/src/lib/api.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/providers/__tests__/phaseHooks.test.tsx

key-decisions:
  - "phasesByThread defaults EMPTY with NO streamsCache/localStorage read (ephemeral, reconciled on mount — mirrors pendingAsksByThread/workspaceFilesByThread, NOT tasksByThread which persists)."
  - "The 6 phase branches are additive else-ifs AFTER cap_paused with NO return so the cursor-advance still fires — Deep dispatch byte-identical (the BINDING invariant), proven by a 64/0 git diff + 0 removed Deep dispatch lines."
  - "usePhases reconcile uses a reconcilePhases adapter (NOT getThreadWorkflow directly) because getThreadWorkflow returns a single ThreadWorkflowState, not Phase[]; the adapter derives the Phase[] reconcile-floor skeleton and keeps getThreadWorkflow in the selector per the acceptance grep."
  - "onRunFailed uses an empty-slug sentinel resolved in setPhaseStatusForThread to the latest non-terminal phase, so a run-level failure marks the phase that was live without the wire carrying a slug."

patterns-established:
  - "PANEL-09 zero-chat-re-render isolation: phasesByThread is panel-only; useThreadMessages (the chat selector) reads bucketsBySurface EXCLUSIVELY and is byte-identical — proven by the INV-1 reference-identity test."
  - "Per-thread keying for cross-thread isolation: every phase write keys by the makeStreamCallbacks factory's closed-over OWNING threadId (never the viewed thread / a global flag) — proven by the INV-5 isolation test."

requirements-completed: [PANEL-08, PANEL-09]

# Metrics
duration: 9min
completed: 2026-06-04
---

# Phase 094 Plan 02: Harness Phase-Event Demux → Panel State Summary

**Wired the dropped harness lifecycle events into a panel-only `phasesByThread` slice via 6 additive byte-identical-Deep SSE branches in `api.ts`, the OWNING-threadId-keyed `onPhase*` demux + 3 action bodies + a `usePhases` reconcile-floor selector — flipping `phaseHooks.test.tsx` GREEN (PANEL-09 zero-chat-re-render + per-thread isolation).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-04T18:38:53Z
- **Completed:** 2026-06-04T18:47:27Z
- **Tasks:** 3
- **Files modified:** 5 (4 source + 1 test)

## Accomplishments

- The harness lifecycle events (`phase_started`/`phase_completed`/`phase_transition`/`gate_failed`/`run_failed`/`run_completed`) — wire-emitted but silently dropped by `api.ts` since the harness shipped — now become panel state through exactly ONE additive normalizer. This is the PANEL-08/PANEL-09 substrate Plan 03's timeline renders.
- **Deep dispatch provably byte-identical** — the BINDING invariant. The cumulative `api.ts` diff is **64 insertions / 0 deletions**, with **0** removed Deep dispatch lines (`delta`/`sources`/`tool_end`/`ask_user_prompt`/`done` all untouched) and **0** `return` statements inside the new branch block (the only `return` mentions are comments asserting the rule). The 6 branches sit AFTER `cap_paused`, before the cursor-advance, carrying no `return` — so Deep keeps working exactly as before.
- **PANEL-09 zero-chat-re-render proven**: the `phasesByThread` slice is panel-only; the chat selector `useThreadMessages` is byte-identical (zero diff on its export line) and reads `bucketsBySurface` exclusively. The INV-1 reference-identity test passes — replaying `fxPhaseLlmAgent` leaves `bucketsBySurface` reference-identical while `phasesByThread.get(THREAD_A)` populates (running → done).
- **Cross-thread isolation proven**: every phase write keys by the OWNING thread id (the factory's closed-over `threadId`). The INV-5 test passes — a `phase_started` on THREAD_A leaves THREAD_B's timeline reference-identical.

## Task Commits

Each task was committed atomically (sequential on `v2.5-dev`, normal commits WITH hooks):

1. **Task 1: Phase type + phasesByThread store slice + no-op action stubs** — `6f32921e` (feat)
2. **Task 2: additive harness phase-lifecycle SSE branches in api.ts (Deep byte-identical) + flip phaseHooks RED scaffold to real INV-1/INV-5 tests** — `55b3bc82` (feat)
3. **Task 3: onPhase* demux defaults + 3 phase action bodies + usePhases selector (PANEL-09)** — `01d2f909` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_Note: Tasks 2/3 are `tdd="true"`. Per the `type: execute` convention, the RED test was authored in Task 2 (committed RED against the un-wired provider) and flipped GREEN by Task 3's action bodies — no discrete `test(...)` RED commit; the suite is run at the end of Task 3._

## Files Created/Modified

- `frontend/src/types/index.ts` (MODIFIED) — the `Phase` type per DATA-CONTRACT §3b (`slug/phaseIndex/phaseType/status/attempt?/error?/subAgents/pendingAsk`); `subAgents` reuse `TaskRunIndexItem`; `pendingAsk` is a `tool_call_id` POINTER into `pendingAsksByThread` (not duplicated).
- `frontend/src/stores/streamsStore.ts` (MODIFIED) — the `phasesByThread: Map<string, Phase[]>` slice beside `workflowLockByThread`, defaulted EMPTY (no cache read), + the `appendPhaseForThread`/`setPhaseStatusForThread`/`replacePhasesForThread` action interface decls + synchronous no-op `() => {}` stubs (Pitfall 5).
- `frontend/src/lib/api.ts` (MODIFIED) — 6 additive `StreamCallbacks` (`onPhaseStarted`/`onPhaseCompleted`/`onPhaseTransition`/`onGateFailed`/`onRunFailed`/`onRunCompleted`) + 6 additive dispatch branches reading FLAT producer fields, AFTER `cap_paused`, no `return`.
- `frontend/src/providers/StreamsProvider.tsx` (MODIFIED) — the `onPhase*` demux defaults (OWNING-threadId-keyed) in `makeStreamCallbacks`, the 3 phase action bodies (`new Map(prev)` copy-then-mutate, slug-keyed; empty-slug sentinel for `run_failed`), the `usePhases(threadId)` selector + `reconcilePhases` adapter wrapping `getThreadWorkflow` into the Phase[] reconcile floor, + the `EMPTY_PHASES` stable ref. `useThreadMessages` byte-identical.
- `frontend/src/providers/__tests__/phaseHooks.test.tsx` (MODIFIED) — flipped the Plan-01 RED `it.todo` scaffold to real INV-1 (PANEL-09 reference-identity) + INV-5 (per-thread isolation) tests, mirroring `panelHooks.test.tsx` (partial-mock `@/lib/api` keeping REAL `subscribeToRun` + `makeStreamCallbacks`; replays the shared `fxPhaseLlmAgent` fixture).

## Decisions Made

- **Ephemeral default (no cache read)** — `phasesByThread` reconciles from `getThreadWorkflow` on every mount, so it starts as a fresh empty Map (mirrors `pendingAsksByThread`, NOT `tasksByThread` which persists to `streamsCache`).
- **`reconcilePhases` adapter** — `usePanelReconcile<Phase>` requires `fetcher: (threadId) => Promise<Phase[]>`, but `getThreadWorkflow` returns a single `ThreadWorkflowState`. The adapter wraps it and derives the Phase[] reconcile-floor skeleton (`total_phases` rows, all `pending`, the current one `running`; `[]` when Deep / stale-lock / no run). Keeps `getThreadWorkflow` in the `usePhases` reconcile path (the acceptance grep) while honoring both the type contract and the D-v2.5-03 reconcile-floor semantics.
- **Empty-slug "active phase" sentinel** — `onRunFailed` calls `setPhaseStatusForThread(threadId, "", "failed", {error})`; the body resolves the empty slug to the latest non-terminal (running/retrying/pending) phase (the one live when the run died), falling back to the last row so a failure is never silently dropped.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–4 triggers. The `reconcilePhases` adapter and the empty-slug sentinel are not deviations: the plan's Task-3 action explicitly named `fetcher: getThreadWorkflow` + `onRunFailed -> mark the latest running phase "failed"`; both are the faithful, type-correct realization of that instruction (`getThreadWorkflow` returns an object, not `Phase[]`, so a thin derive-adapter is the only way to satisfy both the named fetcher and the `usePanelReconcile<Phase>` contract).

## Issues Encountered

- **`npm run build` (`tsc -b`) does not exit 0 — documented pre-existing 54-error baseline, ZERO net-new.** The repo carries a fixed 54-error `tsc -b` baseline across unrelated files (per STATE.md / Plan 01 SUMMARY). After Task 1 the count was momentarily 55 — the single transient was the StreamsProvider mount-time `setState` actions-object missing the 3 new phase mutators (the store interface MUST declare them in Task 1 for Task 3 to implement; this is the intended cross-task ordering). **Task 3's action bodies resolved it — `tsc -b` is back to exactly 54** (verified: `git stash` of this plan's files returns the SAME 54; the wiring cascade is fully closed). The load-bearing intent (CSS compiles, the new module type-checks, the bundle builds) was verified directly: **`npx vite build` succeeds cleanly** (only pre-existing chunk-size + dynamic-import warnings). Per the SCOPE BOUNDARY rule the 54 baseline errors in unrelated files were NOT touched.

## Verification

- **`npx vitest run src/providers/__tests__/phaseHooks.test.tsx`** = **2/2 GREEN** (INV-1 reference-identity + INV-5 per-thread isolation).
- **Full provider + panel suite** (`src/providers/__tests__/` + `src/components/panel/__tests__/`) = **10 files passed / 3 skipped, 107 tests passed / 12 todo / 0 failed** — no regression to the existing panelHooks/PendingAskCard suites; the 12 todo are the downstream-owned scaffolds (PhaseTimeline/FailReason/PhaseReconcile → Plan 03; RC-4 backend → Plan 04).
- **Deep byte-identical (BINDING):** cumulative `git diff cb6d01b9..HEAD frontend/src/lib/api.ts` = **64 insertions / 0 deletions**; 0 removed Deep dispatch lines; 0 `return` in the new branch block (only comment mentions).
- **PANEL-09:** `useThreadMessages` selector export line has ZERO diff; INV-1 proves `bucketsBySurface` reference-identical across a phase replay.
- **Greps:** `phase_started` ×3 in api.ts (≥1); all 6 callback names present; `phasesByThread` ×4 in streamsStore.ts (≥3); all 3 action names present; `export interface Phase` matches; `new Map<string, Phase` matches (empty default); `usePhases` exported; `getThreadWorkflow` ×5 in StreamsProvider (in the `usePhases` reconcile path).
- **`tsc -b` = 54** (the documented baseline, **0 net-new**); **`npx vite build` clean.**

## Known Stubs

None that block the plan's goal. `reconcilePhases` derives a Phase[] skeleton with `phaseType: "unknown"` for not-yet-started rows — this is the INTENTIONAL reconcile-floor (DATA-CONTRACT §3c): the live `phase_started` events fill the real `phaseType` as phases run; `unknown` falls back to the generic "Step" render (DATA-CONTRACT §2 UNKNOWN-phase_type rule), never a crash. The `[]` returns (Deep / stale-lock / no run) are correct emptiness, not unwired stubs. Plan 03 renders the timeline over this slice.

## Next Phase Readiness

- **Plan 03** can build `PhaseTimeline`/`PhaseCard` against the live `usePhases(threadId)` selector + the `fxRun*` fixtures, flipping `PhaseTimeline.test.tsx`/`FailReason.test.tsx`/`PhaseReconcile.test.tsx` GREEN (INV-2/3b/4). The slice surfaces `status` (5/6-state), `attempt`, `error`, and the `Phase i/N` reconcile floor it renders.
- **Plan 05** can read `usePhases` for the unified-surface count-strip / receipt.
- No blockers. The demux + slice + selector are the PANEL-08/09 substrate the downstream render plans depend on.

---

## Self-Check: PASSED

All 5 modified files verified present on disk; all 3 task commits (`6f32921e`, `55b3bc82`, `01d2f909`) verified in git history.

---
*Phase: 094-workflow-legibility-mode-clarity*
*Completed: 2026-06-04*
