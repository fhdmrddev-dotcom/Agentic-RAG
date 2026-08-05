/**
 * Phase 094 Plan 03 — INV-4 (the D-v2.5-03 reconcile-is-the-floor anti-drift rule,
 * DATA-CONTRACT §3(c)/§6 LOADING). Flips the Plan-01 Wave 0 RED scaffold GREEN.
 *
 * On mount the reconcile seeds `current_phase_index` + `total_phases`; thereafter
 * LIVE events mutate forward but NEVER move the "Phase i / N" counter backward.
 *
 * INV-4:
 *   - seed reconcile {current_phase_index:1, total_phases:3} (the fxRunRunning
 *     reconcileSeed) → the full 3-row skeleton renders BEFORE any further live
 *     event (the mount spinner-killer) with "Phase 2 / 3".
 *   - a regressing live phase_started{phase_index:0} arriving AFTER never moves
 *     the rendered "Phase i / N" backward.
 *
 * We drive the timeline through controlled `usePhases`/`useTasks` mocks (the same
 * `Phase[]` the reconcilePhases adapter + the live demux produce), re-rendering
 * with a regressing array to assert the counter floor holds.
 *
 * ── Phase 188 Plan 02 (RUNVIZ-02 / Req 3 / D-188-08 / D-188-09) ───────────────
 *
 * TWO FALSIFICATION BLOCKS WERE ADDED AT THE BOTTOM OF THIS FILE, AND BOTH WERE
 * WRITTEN AND OBSERVED RED AGAINST UNMODIFIED PRODUCTION SOURCE BEFORE A SINGLE
 * LINE OF `StreamsProvider.tsx` CHANGED (D-188-09; the 187-01 precedent). The raw
 * failing vitest output for both is pasted verbatim into `188-02-SUMMARY.md`, and
 * the received value is recorded in a comment above each block, so the observation
 * cannot be retro-fitted later. A fail-open nobody has watched fail is a gesture.
 *
 * The two lies, and why BOTH are here rather than only the one the SPEC named:
 *   · The SPEC named `DB_PHASE_STATUS[r.status] ?? "done"` — an unrecognised
 *     server-supplied status reading as SUCCESS. All five DB values are mapped
 *     today, so it is unreachable with shipped data — but the publish gauntlet's
 *     `findIndex → -1` painted an unknown `blocked_stage` as 8/8 green on exactly
 *     that "unreachable" argument, and shipped.
 *   · `finalizeAllPhasesForThread` sweeps `pending` → `done` on a successful run
 *     completion, and `skip_to_phase` leaves every jumped-over phase `pending` in
 *     `workflow_phases` forever (`harness_engine.py:1561-1563`). THIS ONE FIRES
 *     TODAY: a step that never ran paints Complete live and Not started after a
 *     refresh — SPEC failure conditions #2 and #3 at once.
 *
 * THE MOCK BELOW IS NOW A *PARTIAL* MOCK. It was a total mock (three exports); it
 * spreads `...actual` now so the two new blocks can mount the REAL StreamsProvider
 * (whose `useEffect` registers the real action bodies — the store's own defaults are
 * no-ops) and reach the REAL `usePhases`. The three overrides are byte-identical to
 * what they were, so the two INV-4 cases above are unchanged.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import { render, screen, cleanup, renderHook, act, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Phase } from "@/types"
import { fxRunRunningReconcileSeed } from "@/test-fixtures/harness094"

// Controlled hook state — the timeline reads usePhases/useTasks + getThreadWorkflow.
const hookState: { phases: Phase[] } = { phases: [] }

// Phase 188-02: mounting the REAL StreamsProvider evaluates the real module, whose
// getAuthHeaders path reads supabase.auth.getSession(). Stub it so no test reaches a
// real URL (the PhaseTimeline.test.tsx / phaseHooks.test.tsx posture).
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

vi.mock("@/providers/StreamsProvider", async () => {
  const actual =
    await vi.importActual<typeof import("@/providers/StreamsProvider")>(
      "@/providers/StreamsProvider",
    )
  return {
    ...actual,
    usePhases: () => ({ data: hookState.phases, isLoading: false, error: null, reconcile: vi.fn() }),
    useTasks: () => ({ data: [], isLoading: false, error: null, reconcile: vi.fn() }),
    useViewingThread: () => "thread-recon",
  }
})

// getThreadWorkflow supplies the run-level frame (definition_name / run_status).
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getThreadWorkflow: mockGetThreadWorkflow,
    // Phase 188-02: the real provider mount fires its panel reconciles + the chat
    // snapshot path on mount. Stub the GETs so no block touches the network.
    getThreadTodos: vi.fn().mockResolvedValue([]),
    getThreadWorkspaceFiles: vi.fn().mockResolvedValue([]),
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
    getThreadTasks: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

import { PhaseTimeline } from "../PhaseTimeline"
import { useStreamsStore } from "@/stores/streamsStore"

// The REAL provider module, unmocked. RED 2 must drive the genuine `reconcilePhases`
// — a module-PRIVATE function whose only reachable door is the real `usePhases`, and
// this file's own mock replaces that export for the INV-4 cases above. `importActual`
// is memoised per path, so this is the same instance the mock factory spread, and the
// zustand store it closes over is the same singleton `useStreamsStore` below.
const RealStreams =
  await vi.importActual<typeof import("@/providers/StreamsProvider")>(
    "@/providers/StreamsProvider",
  )

/** Build the reconcile-floor skeleton the adapter produces (DATA-CONTRACT §3c). */
function skeleton(currentPhaseIndex: number, totalPhases: number): Phase[] {
  return Array.from({ length: totalPhases }, (_, i): Phase => ({
    slug: `phase-${i}`,
    phaseIndex: i,
    phaseType: "unknown",
    status: i < currentPhaseIndex ? "done" : i === currentPhaseIndex ? "running" : "pending",
    subAgents: [],
    pendingAsk: null,
  }))
}

beforeEach(() => {
  hookState.phases = []
  mockGetThreadWorkflow.mockResolvedValue({
    mode: "harness",
    definition_name: "X",
    run_status: "running",
    current_phase_index: fxRunRunningReconcileSeed.current_phase_index,
    total_phases: fxRunRunningReconcileSeed.total_phases,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("Phase 094 — reconcile floor / forward-only counter (INV-4)  [owner: Plan 03]", () => {
  it("the full N-phase skeleton renders from total_phases alone (3 rows) before any further live event", () => {
    // The reconcilePhases adapter seeds total_phases=3 rows on mount (the seed
    // gives current_phase_index:1, total_phases:3 → 3 rows: done, running, pending).
    hookState.phases = skeleton(
      fxRunRunningReconcileSeed.current_phase_index,
      fxRunRunningReconcileSeed.total_phases,
    )
    render(<PhaseTimeline threadId="thread-recon" />)

    // 3 phase rows render from total_phases alone — NOT a spinner.
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)
    // The honest "Phase 2 / 3" counter (current_phase_index 1 → ordinal 2).
    expect(screen.getByText("Phase 2 / 3")).toBeInTheDocument()
  })

  it("a regressing live phase_started{phase_index:0} never moves Phase i/N backward", () => {
    hookState.phases = skeleton(1, 3) // active = index 1 → "Phase 2 / 3"
    const { rerender } = render(<PhaseTimeline threadId="thread-recon" />)
    expect(screen.getByText("Phase 2 / 3")).toBeInTheDocument()

    // A regressing event flips the active row back to index 0 (running) — the
    // counter must NOT regress to "Phase 1 / 3" (reconcile is the floor).
    const regressed = skeleton(3, 3).map((p, i): Phase =>
      i === 0 ? { ...p, status: "running" } : { ...p, status: "pending" },
    )
    hookState.phases = regressed
    rerender(<PhaseTimeline threadId="thread-recon" />)

    // The counter holds its floor — never "Phase 1 / 3".
    expect(screen.queryByText("Phase 1 / 3")).not.toBeInTheDocument()
    expect(screen.getByText("Phase 2 / 3")).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 188 Plan 02 — the two fail-open falsifications (Req 3 / D-188-08/09).
// ─────────────────────────────────────────────────────────────────────────────

const THREAD_SWEEP = "thread-188-sweep"
const THREAD_TERMINAL = "thread-188-terminal"

/** Clear the per-thread phase Map so a block starts from a known slice. */
function resetPhases() {
  useStreamsStore.setState({ phasesByThread: new Map<string, Phase[]>() })
}

/**
 * Mount the REAL StreamsProvider so its `useEffect` registers the real action
 * bodies. `streamsStore`'s own `finalizeAllPhasesForThread` / `replacePhasesForThread`
 * defaults are `() => {}`, so without this mount both blocks below would assert
 * against a no-op and pass for the wrong reason.
 */
function mountRealProvider() {
  return renderHook(() => null, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <RealStreams.StreamsProvider>{children}</RealStreams.StreamsProvider>
    ),
  })
}

// ── RED 1 — THE REACHABLE FAIL-OPEN: the sweep swallows a never-ran phase ─────
//
// OBSERVED RED on unmodified production source, 2026-08-05, `npx vitest run
// src/components/panel/__tests__/PhaseReconcile.test.tsx` at 7 tests | 2 failed
// (see 188-02-SUMMARY.md for the full raw vitest output). Verbatim:
//
//   FAIL  src/components/panel/__tests__/PhaseReconcile.test.tsx > Phase 188 —
//   finalizeAllPhasesForThread sweep honesty (Req 3, the REACHABLE fail-open) >
//   the phase a skip_to_phase jumped over survives run completion as pending
//   AssertionError: a step the harness never started is not Complete: expected
//   'done' to be 'pending' // Object.is equality
//
//   Expected: "pending"
//   Received: "done"
//
//    ❯ src/components/panel/__tests__/PhaseReconcile.test.tsx:252:81
//
// i.e. THE RECEIVED VALUE WAS "done" WHERE "pending" WAS EXPECTED — the product
// told the user a step had completed that the harness had never started.
//
// WHY IT IS REACHABLE. `skip_to_phase` marks ONLY the current phase `skipped`
// (`harness_engine.py:1561-1563`); every phase between it and the jump target keeps
// `status='pending'` in `workflow_phases` for the life of the run, and nothing ever
// revisits them. `finalizeAllPhasesForThread` fires on `run_completed` with
// `status === "completed"` (`StreamsProvider.tsx:1034-1035`) and sweeps
// `running | retrying | pending` → `done`. So the live canvas paints a step that
// never ran as Complete, while a refresh (which rebuilds from those same DB rows)
// restores Not started. The sweep's OWN docblock is the argument against it: "NEVER
// touch a phase that legitimately ended failed/skipped — those are terminal truths,
// not stragglers." A never-ran `pending` is a terminal truth by the same logic.
describe("Phase 188 — finalizeAllPhasesForThread sweep honesty (Req 3, the REACHABLE fail-open)", () => {
  beforeEach(() => {
    resetPhases()
  })

  it("the phase a skip_to_phase jumped over survives run completion as pending", () => {
    mountRealProvider()
    // A skip-bearing shape: 0 ran, 1 was skipped by the jump, 2 was JUMPED OVER and
    // never started, 3 is the live step the completion is about to finish.
    const seeded: Phase[] = [
      { slug: "intake", phaseIndex: 0, phaseType: "programmatic", status: "done", subAgents: [], pendingAsk: null },
      { slug: "review", phaseIndex: 1, phaseType: "llm_agent", status: "skipped", subAgents: [], pendingAsk: null },
      { slug: "approve", phaseIndex: 2, phaseType: "llm_human_input", status: "pending", subAgents: [], pendingAsk: null },
      { slug: "publish", phaseIndex: 3, phaseType: "llm_single", status: "running", subAgents: [], pendingAsk: null },
    ]
    act(() => {
      useStreamsStore.getState().actions.replacePhasesForThread(THREAD_SWEEP, seeded)
    })

    act(() => {
      useStreamsStore.getState().actions.finalizeAllPhasesForThread(THREAD_SWEEP)
    })

    const after = useStreamsStore.getState().phasesByThread.get(THREAD_SWEEP) ?? []
    expect(after).toHaveLength(4)
    // THE FALSIFICATION: index 2 never started, so it is not Complete.
    expect(after[2].status, "a step the harness never started is not Complete").toBe("pending")
    // The reload agrees with the live view: a refresh rebuilds index 2 from a DB row
    // that still reads `pending`, so anything but `pending` here is a disagreement.
    expect(after[2].status).not.toBe("done")
  })

  it("POSITIVE CONTROL — the legitimate straggler still sweeps: running → done, and skipped/done are untouched", () => {
    mountRealProvider()
    const seeded: Phase[] = [
      { slug: "intake", phaseIndex: 0, phaseType: "programmatic", status: "done", subAgents: [], pendingAsk: null },
      { slug: "review", phaseIndex: 1, phaseType: "llm_agent", status: "skipped", subAgents: [], pendingAsk: null },
      { slug: "approve", phaseIndex: 2, phaseType: "llm_human_input", status: "pending", subAgents: [], pendingAsk: null },
      { slug: "publish", phaseIndex: 3, phaseType: "llm_single", status: "running", subAgents: [], pendingAsk: null },
    ]
    act(() => {
      useStreamsStore.getState().actions.replacePhasesForThread(THREAD_SWEEP, seeded)
    })
    act(() => {
      useStreamsStore.getState().actions.finalizeAllPhasesForThread(THREAD_SWEEP)
    })

    const after = useStreamsStore.getState().phasesByThread.get(THREAD_SWEEP) ?? []
    // The Phase-098-UAT reason the sweep exists: a `phase_completed` SSE missed
    // across an ask_user pause / consumer reattach leaves a phase stuck `running`.
    // That case MUST still be corrected — this is what makes the assertion above a
    // measurement of the PREDICATE rather than a disabled sweep.
    expect(after[3].status, "the running straggler must still be finalised").toBe("done")
    // And the two terminal truths are still terminal truths.
    expect(after[0].status).toBe("done")
    expect(after[1].status).toBe("skipped")
  })

  it("POSITIVE CONTROL — `retrying` is swept too, so the predicate is narrowed by exactly one member", () => {
    mountRealProvider()
    act(() => {
      useStreamsStore.getState().actions.replacePhasesForThread(THREAD_SWEEP, [
        { slug: "retry-me", phaseIndex: 0, phaseType: "llm_agent", status: "retrying", subAgents: [], pendingAsk: null },
      ])
    })
    act(() => {
      useStreamsStore.getState().actions.finalizeAllPhasesForThread(THREAD_SWEEP)
    })
    const after = useStreamsStore.getState().phasesByThread.get(THREAD_SWEEP) ?? []
    expect(after[0].status).toBe("done")
  })
})

// ── RED 2 — THE FALLBACK: an unrecognised DB status must not read as success ──
//
// ⚠ THIS BLOCK MUST DRIVE THE **TERMINAL** BRANCH OF `reconcilePhases`. The LIVE
// branch (`wf.mode === "harness" && !wf.lock_is_stale`) synthesises statuses
// POSITIONALLY from `current_phase_index` and never touches `DB_PHASE_STATUS` at
// all — a test that drives it is green before AND after the fix and proves exactly
// nothing. The terminal branch is entered with `lock_is_stale: true` (an anchored
// run that has ended), and it is the branch that maps `wf.phases` rows.
//
// OBSERVED RED on unmodified production source, 2026-08-05, in the SAME run as
// RED 1 (see 188-02-SUMMARY.md for the full raw vitest output). Verbatim:
//
//   FAIL  src/components/panel/__tests__/PhaseReconcile.test.tsx > Phase 188 —
//   reconcilePhases TERMINAL branch fallback (Req 3 / D-188-08) > an unmapped DB
//   status reconciles to the explicit unknown reading, never done
//   AssertionError: an unrecognised server status must never read as success:
//   expected 'done' not to be 'done' // Object.is equality
//
//    ❯ src/components/panel/__tests__/PhaseReconcile.test.tsx:344:96
//
// i.e. THE RECEIVED VALUE WAS "done" — the `?? "done"` fallback inferred success
// from a status string the client does not recognise at all.
//
// THE UNMAPPED LITERAL IS ASSEMBLED FROM PARTS (the 187-24 lesson) so this file's
// own source can never satisfy a later grep run over it.
const UNMAPPED = ["quaran", "tined"].join("")

describe("Phase 188 — reconcilePhases TERMINAL branch fallback (Req 3 / D-188-08)", () => {
  beforeEach(() => {
    resetPhases()
    // TERMINAL: an anchored run whose lock is stale → the `wf.phases` row branch.
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      lock_is_stale: true,
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 1,
      total_phases: 2,
      phases: [
        { slug: "intake", phase_index: 0, status: "completed", phase_type: "programmatic" },
        { slug: "publish", phase_index: 1, status: UNMAPPED, phase_type: "llm_single" },
      ],
    })
  })

  it("an unmapped DB status reconciles to the explicit unknown reading, never done", async () => {
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_TERMINAL))
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    const unmappedRow = result.current.data[1]
    // THE FALSIFICATION: success is never INFERRED from a value we do not recognise.
    expect(unmappedRow.status, "an unrecognised server status must never read as success").not.toBe(
      "done",
    )
    expect(unmappedRow.status).toBe("unknown")
  })

  it("POSITIVE CONTROL — a recognised `completed` row still reconciles to done, so the map itself still works", async () => {
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_TERMINAL))
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    // If this ever goes red, the fallback change broke the mapping rather than the
    // fail-open — which is the failure mode the assertion above cannot see alone.
    expect(result.current.data[0].status).toBe("done")
    expect(result.current.data[0].slug).toBe("intake")
    // And the terminal branch really was the one exercised: it carries REAL slugs
    // off `wf.phases`, where the live branch would have emitted `phase-1`.
    expect(result.current.data[1].slug).toBe("publish")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 188 Plan 04 — BUG-260609-04, at its root (RUNVIZ-01 / RUNVIZ-02 / D-188-22).
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠ THIS BLOCK DRIVES THE **LIVE** BRANCH — the mirror image of RED 2 above, which
// had to drive the TERMINAL one. Live is selected by `wf.mode === "harness" &&
// !wf.lock_is_stale`, and it is the branch that builds the positional
// `Array.from({length: total_phases})` skeleton whose non-current rows carry the
// placeholder slug `phase-${i}` and the flat `phaseType: "unknown"`.
//
// THE BUG (BUG-260609-04, reported 2026-06-10, `folded_into: "188"`): that skeleton
// was written on the premise that only `current_phase_slug` is knowable mid-run.
// RESEARCH Open Question 4 measured the premise FALSE: `create_workflow_run`
// (`backend/app/db/workflows.py:206-214`) inserts EVERY `workflow_phases` row at run
// creation in one transaction — it is the only `INSERT INTO workflow_phases` in
// `backend/app` — and `GET /threads/{id}/workflow` returns `slug + phase_index +
// status + phase_type` for all of them, live and terminal alike. So the real names
// are already on the wire and the skeleton is discarding them.
//
// THE SECOND, PREVIOUSLY UNRECORDED HALF: the same line loses `phaseType` too. The
// report only ever named the slug; `phaseType: "unknown"` is the same defect on the
// same row, and one overlay closes both.
//
// OBSERVED RED on unmodified production source, 2026-08-05, `npx vitest run
// src/components/panel/__tests__/PhaseReconcile.test.tsx` at 12 tests | 3 failed
// — the other 9 green, INCLUDING the floor guard and the fallback control below
// (the full raw vitest output is pasted verbatim into `188-04-SUMMARY.md`). The
// three received values, verbatim:
//
//   AssertionError: the first step's real name, not a positional placeholder:
//   expected 'phase-0' to be 'collect-inputs' // Object.is equality
//   Expected: "collect-inputs"     Received: "phase-0"
//
//   AssertionError: a later step's real name is already on the wire:
//   expected 'phase-2' to be 'check-the-numbers' // Object.is equality
//   Expected: "check-the-numbers"  Received: "phase-2"
//
//   AssertionError: expected [ 'unknown', 'unknown', …(2) ] to strictly equal
//   [ 'programmatic', 'llm_agent', …(2) ]
//
// i.e. THE RECEIVED SLUGS WERE THE POSITIONAL PLACEHOLDERS `phase-0` / `phase-2`
// while the server had already sent `collect-inputs` / `check-the-numbers`, and
// EVERY phaseType read `"unknown"` while the server had sent a real type for each.
//
// ── AND THE FENCE THE FIX MUST NOT BREAK ─────────────────────────────────────
//
// The floor guard in this same block is GREEN BEFORE THE FIX and must stay green
// after. It is not a falsification; it is the mechanical fence around T-188-04-01.
// The fixture's DB rows are deliberately BEHIND the positional derivation (index 0
// is still `pending` in `workflow_phases` even though `current_phase_index` is 1),
// which is the real mid-run shape: a row only flips at `complete_phase`. Overlaying
// STATUS as well as identity would therefore drag `PhaseTimeline`'s shipped
// forward-only counter (`PhaseTimeline.tsx:115-127`) BACKWARD — a regression dressed
// as a fix, and strictly worse than the cosmetic bug being closed. The overlay is
// IDENTITY ONLY: `slug` and `phaseType`, never `status`.
//
// That same assertion doubles as the mechanical proof that the LIVE branch really
// was the one exercised: the terminal branch maps a DB `pending` straight through to
// `pending`, so a `done` at index 0 can only have come from the positional
// derivation.

const THREAD_LIVE = "thread-188-live"

/** The four real `workflow_phases` rows a LIVE run already has from t=0. */
const LIVE_ROWS = [
  { slug: "collect-inputs", phase_index: 0, status: "pending", phase_type: "programmatic" },
  { slug: "draft-the-letter", phase_index: 1, status: "pending", phase_type: "llm_agent" },
  { slug: "check-the-numbers", phase_index: 2, status: "pending", phase_type: "llm_single" },
  { slug: "produce-the-report", phase_index: 3, status: "pending", phase_type: "llm_emit" },
]

describe("Phase 188 — reconcilePhases LIVE branch identity overlay (BUG-260609-04 / D-188-22)", () => {
  beforeEach(() => {
    resetPhases()
    // LIVE: a harness run whose lock is FRESH → the positional-skeleton branch.
    // Every DB row still reads `pending` (they flip only at `complete_phase`), which
    // is exactly the mid-run state that makes a status overlay dangerous.
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      lock_is_stale: false,
      definition_name: "Quarterly board letter",
      run_status: "running",
      total_phases: 4,
      current_phase_index: 1,
      current_phase_slug: "draft-the-letter",
      phases: LIVE_ROWS,
    })
  })

  it("a non-current EARLIER step carries its real name, not the positional placeholder", async () => {
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // THE BUG, at index 0: `phase-0` is a synthetic positional name the operator
    // cannot match to any step they authored. The server sent `collect-inputs`.
    expect(
      result.current.data[0].slug,
      "the first step's real name, not a positional placeholder",
    ).toBe("collect-inputs")
    expect(result.current.data[0].slug).not.toBe("phase-0")
  })

  it("a non-current LATER step carries its real name too", async () => {
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // Ahead of the current index, not just behind it — the skeleton clobbered both.
    expect(
      result.current.data[2].slug,
      "a later step's real name is already on the wire",
    ).toBe("check-the-numbers")
    expect(result.current.data[2].slug).not.toBe("phase-2")
    // And the CURRENT row keeps the name it already had (it was the one position the
    // skeleton got right, via `current_phase_slug`) — the overlay must not regress it.
    expect(result.current.data[1].slug).toBe("draft-the-letter")
    expect(result.current.data[3].slug).toBe("produce-the-report")
  })

  it("every step carries its real phase type — the second, previously unrecorded half of the same bug", async () => {
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // The report only ever named the slug. `phaseType: "unknown"` is the same defect
    // on the same row, and it is what drives the step's icon and its type sentence.
    expect(result.current.data.map((p) => p.phaseType)).toStrictEqual([
      "programmatic",
      "llm_agent",
      "llm_single",
      "llm_emit",
    ])
  })

  it("THE FLOOR GUARD — status stays POSITIONAL: a DB row lagging behind the counter never drags it backward", async () => {
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // Green BEFORE the fix and green after — this is the fence, not a falsification.
    // Index 0's DB row still says `pending` (it flips only at `complete_phase`), yet
    // the positional derivation says `done` because `current_phase_index` is 1. The
    // DERIVATION must win: overlaying status would move the shipped forward-only
    // counter at `PhaseTimeline.tsx:115-127` backward.
    //
    // ⚠ SCOPE, CORRECTED BY CR-06. This case pins the floor for an UNRESOLVED row — the
    // rationale above ("the row flips only at `complete_phase`") is a statement about a
    // `pending` row, and it does not generalise to a row the engine has already resolved.
    // The fix reads that distinction, so this assertion is unchanged and still green;
    // what changed is only that a `skipped` / `failed` / unnameable row no longer falls
    // under it. See the CR-06 block at the bottom of this file.
    expect(
      result.current.data[0].status,
      "the positional floor outranks a lagging DB row — status is NOT overlaid",
    ).toBe("done")
    expect(result.current.data[1].status).toBe("running")
    expect(result.current.data[2].status).toBe("pending")
    expect(result.current.data[3].status).toBe("pending")
    // The `done` above is ALSO the proof that the LIVE branch was exercised: the
    // terminal branch maps a DB `pending` straight through to `pending`.
  })

  it("POSITIVE CONTROL — with no `phases` on the wire the placeholder fallback is byte-for-byte unchanged", async () => {
    // Defence in depth. RESEARCH OQ4 measured that this case cannot occur against the
    // shipped backend (every row exists from run creation), so the fallback is not
    // load-bearing — but a fallback nobody exercised is a fallback nobody has read.
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      lock_is_stale: false,
      definition_name: "Quarterly board letter",
      run_status: "running",
      total_phases: 4,
      current_phase_index: 1,
      current_phase_slug: "draft-the-letter",
      phases: null,
    })
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    expect(result.current.data.map((p) => p.slug)).toStrictEqual([
      "phase-0",
      "draft-the-letter",
      "phase-2",
      "phase-3",
    ])
    expect(result.current.data.map((p) => p.phaseType)).toStrictEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
    ])
    // `total_phases` remains the array length — kept as defence in depth, never
    // presented as load-bearing (RESEARCH OQ4 consequence 2).
    expect(result.current.data).toHaveLength(4)
  })
})

// ── CR-06 (Phase 188 review) — the fail-open that survived ONE FUNCTION AWAY ───────────
//
// Plan 02 narrowed `finalizeAllPhasesForThread` for a carefully-argued reason:
//
//   "`skip_to_phase` marks ONLY the current phase … every phase between it and the jump
//    target keeps `status='pending'` … nothing ever revisits them. So on any skip-bearing
//    workflow this sweep painted a step that NEVER RAN as Complete, while a reconcile
//    rebuilt from those same rows restored 'Not started': the live view and the reload
//    disagreed … which is precisely what Req 4 forbids."
//
// The identical fail-open lived on in the LIVE branch's own positional derivation, where
// `i < current` painted Complete over whatever the DB row said. It is the SAME argument
// under the SAME requirement, so it gets the same answer.
//
// MEASURED, so the fixtures below are the real shape and not a supposition:
//   · `harness_engine.py` skip branch — `await skip_phase(pool, phase_id)` flips the
//     from-phase to `skipped`, then `i = target_i; continue`. Every row between it and the
//     target keeps `pending` and nothing revisits them.
//   · `advance_current_phase` is called at ONE site (after `complete_phase`/`fail_phase`),
//     and NOT on the skip branch — so the cursor can legitimately still be parked on the
//     SKIPPED row when a reconcile lands, and can equally be ahead of it once the jump
//     target completes. Both are covered below; both were wrong before the fix, and the
//     parked one is the louder lie (a jumped-over step reported as executing right now).
//
// THE FIX IS NOT "OVERLAY STATUS". The positional derivation is a forward-only floor that
// is sometimes MORE advanced than the rows, and overlaying wholesale is the regression
// 188-04 refused. The rule is narrower: the floor may only ADVANCE a row the DB has left
// UNRESOLVED (`pending`/`active`). A row the engine has already resolved — skipped, failed,
// completed, or a status this client cannot name — is a truth the floor may not overwrite.
// The floor-guard above is unaffected and stays green: its rows are all `pending`, i.e.
// exactly the unresolved case the floor exists for.

const SKIP_ROWS = [
  { slug: "collect-inputs", phase_index: 0, status: "completed", phase_type: "programmatic" },
  // The engine marked this one SKIPPED — an explicit terminal truth, not a lag.
  { slug: "draft-the-letter", phase_index: 1, status: "skipped", phase_type: "llm_agent" },
  // Jumped over. It will never run, and nothing will ever revisit this row.
  { slug: "check-the-numbers", phase_index: 2, status: "pending", phase_type: "llm_single" },
  { slug: "produce-the-report", phase_index: 3, status: "active", phase_type: "llm_emit" },
]

describe("Phase 188 CR-06 — the live floor never UPGRADES a row the engine resolved", () => {
  beforeEach(() => {
    resetPhases()
  })

  function liveFrame(currentIndex: number) {
    return {
      mode: "harness",
      lock_is_stale: false,
      definition_name: "Quarterly board letter",
      run_status: "running",
      total_phases: 4,
      current_phase_index: currentIndex,
      current_phase_slug: SKIP_ROWS[currentIndex].slug,
      phases: SKIP_ROWS,
    }
  }

  it("a SKIPPED row is never painted Complete when the cursor has moved past it", async () => {
    mockGetThreadWorkflow.mockResolvedValue(liveFrame(3))
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // Pre-fix: `1 < 3` → "done". The engine said `skipped`; a reload says `skipped`; the
    // live view said Complete. That is the live-vs-reload disagreement Req 4 forbids.
    expect(
      result.current.data[1].status,
      "the engine resolved this row to skipped — the positional floor may not overwrite it",
    ).toBe("skipped")
    expect(result.current.data[1].status).not.toBe("done")
  })

  it("a SKIPPED row is never painted Running when the cursor is still parked on it", async () => {
    // `advance_current_phase` is NOT called on the skip branch, so this is the state a
    // reconcile lands in for the whole time the jump target is executing.
    mockGetThreadWorkflow.mockResolvedValue(liveFrame(1))
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    expect(
      result.current.data[1].status,
      "a jumped-over step must never be reported as executing right now",
    ).toBe("skipped")
    expect(result.current.data[1].status).not.toBe("running")
  })

  it("a COMPLETED row below the cursor still reads done — the fix changes nothing here", async () => {
    mockGetThreadWorkflow.mockResolvedValue(liveFrame(3))
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // POSITIVE CONTROL. Green before and after; it is here so the two assertions above
    // are a measurement of the skipped row rather than of the branch as a whole.
    expect(result.current.data[0].status).toBe("done")
    expect(result.current.data[3].status).toBe("running")
  })

  it("a FAILED row below the cursor keeps its failure — the other resolved terminal", async () => {
    mockGetThreadWorkflow.mockResolvedValue({
      ...liveFrame(3),
      phases: SKIP_ROWS.map((r) =>
        r.phase_index === 1 ? { ...r, status: "failed" } : r,
      ),
    })
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    // A run that continues past a failed step (the 101.1 graceful-emit-failure path does
    // exactly this) must not have that failure repainted green by the counter.
    expect(result.current.data[1].status).toBe("failed")
    expect(result.current.data[1].status).not.toBe("done")
  })

  it("an UNRECOGNISED row status below the cursor reads unknown, never done", async () => {
    // Req 3's discipline, one level up: a status this client cannot name must never be
    // upgraded to success by a positional counter. The same fail-open, same lesson.
    mockGetThreadWorkflow.mockResolvedValue({
      ...liveFrame(3),
      phases: SKIP_ROWS.map((r) =>
        r.phase_index === 1 ? { ...r, status: "quarantined" } : r,
      ),
    })
    mountRealProvider()
    const { result } = renderHook(() => RealStreams.usePhases(THREAD_LIVE))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    expect(result.current.data[1].status).toBe("unknown")
    expect(result.current.data[1].status).not.toBe("done")
  })
})
