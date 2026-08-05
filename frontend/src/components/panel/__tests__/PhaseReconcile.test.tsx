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
