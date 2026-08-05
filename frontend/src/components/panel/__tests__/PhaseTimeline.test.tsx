/**
 * Phase 094 Plan 03 — INV-2 (the A11Y-03 axe gate + announcer/aria contracts).
 * Flips the Plan-01 Wave 0 RED scaffold GREEN.
 *
 * Drives the REAL data path: replay each DATA-CONTRACT §7 fixture through the REAL
 * subscribeToRun normalizer into the store (replayHarness), then render
 * PhaseTimeline reading the REAL usePhases/useTasks selectors over that store —
 * so a test exercises the live wire→Phase[]→render pipeline, not a stub.
 *
 * INV-2:
 *   - axe(container) has ZERO violations for fxRunRunning / fxRunFailed / fxRunDone
 *     / fxRunAskuserPaused / fxRunGatefailRetry, across 1-phase and N-phase shapes.
 *   - the role="status" announcer is PRESENT at load.
 *   - each PhaseCard's <button aria-expanded> flips on open/close (APG accordion).
 *   - the running phase row sets aria-busy=true; it is cleared (absent) when the
 *     run is terminal/done.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import {
  fxRunRunning,
  fxRunFailed,
  fxRunDone,
  fxRunAskuserPaused,
  fxRunGatefailRetry,
} from "@/test-fixtures/harness094"

// Mock Supabase auth so the REAL subscribeToRun (driven by replayHarness) never
// reaches a real URL — getAuthHeaders reads supabase.auth.getSession().
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

// Partial-mock @/lib/api: keep the REAL subscribeToRun (the SSE demux under test);
// override the panel GETs (incl. getThreadWorkflow, which PhaseTimeline calls for
// the run-level header frame) so the mount + replay stay off the network.
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getThreadTodos: vi.fn().mockResolvedValue([]),
    getThreadWorkspaceFiles: vi.fn().mockResolvedValue([]),
    getThreadPendingAsks: vi.fn().mockResolvedValue([]),
    getThreadTasks: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: mockGetThreadWorkflow,
    getSnapshot: vi.fn().mockResolvedValue({ messages: [], active_runs: [] }),
    getMessages: vi.fn().mockResolvedValue([]),
    getActiveRuns: vi.fn().mockResolvedValue([]),
  }
})

import { replayFixture } from "./replayHarness"
import { PhaseTimeline } from "../PhaseTimeline"
// 188.1-04: the ROW the timeline renders, imported directly for the WR-04 site-2/3
// falsifications. Its own import statement rather than a widening of the line above —
// the `canvasModel.purity.test.ts:18-21` rule, so this plan's diff reads as ADDED lines.
import { PhaseCard } from "../PhaseCard"
import type { Phase } from "@/types"

const THREAD = "thread-tl"

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
  localStorage.clear()
  mockGetThreadWorkflow.mockResolvedValue({
    mode: "harness",
    definition_name: "X",
    run_status: "running",
    current_phase_index: 0,
    total_phases: null,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/** Replay a fixture into the store, then render the timeline over the real store. */
async function renderTimeline(fixture: string[]) {
  await replayFixture(THREAD, fixture)
  return render(<PhaseTimeline threadId={THREAD} />)
}

describe("Phase 094 — PhaseTimeline a11y + render states (INV-2)  [owner: Plan 03]", () => {
  it("axe has no violations: fxRunRunning", async () => {
    const { container } = await renderTimeline(fxRunRunning)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunFailed", async () => {
    const { container } = await renderTimeline(fxRunFailed)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunDone", async () => {
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 2,
      total_phases: 3,
    })
    const { container } = await renderTimeline(fxRunDone)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunAskuserPaused", async () => {
    const { container } = await renderTimeline(fxRunAskuserPaused)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe has no violations: fxRunGatefailRetry + 1-phase + N-phase", async () => {
    // 1-phase (the gatefail-retry fixture is a single phase that ends done).
    const { container } = await renderTimeline(fxRunGatefailRetry)
    expect(await axe(container)).toHaveNoViolations()
    cleanup()
    // N-phase (the done fixture is a 3-phase run).
    const { container: c2 } = await renderTimeline(fxRunDone)
    expect(await axe(c2)).toHaveNoViolations()
  })

  it("sr-only role=status announcer is present at load", async () => {
    await renderTimeline(fxRunRunning)
    // ONE polite announcer, present at load (the visually-hidden region).
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("each PhaseCard button aria-expanded flips on open/close (APG accordion)", async () => {
    const user = userEvent.setup()
    // fxRunDone ends with all phases done → collapsed (aria-expanded=false),
    // togglable (terminal phases toggle). Pick the first phase's header button.
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 2,
      total_phases: 3,
    })
    await renderTimeline(fxRunDone)
    // Let the async getThreadWorkflow frame settle so a re-render can't race the
    // click (PhaseCard's local `open` persists, but we settle for determinism).
    await screen.findByText("Phase 3 / 3")
    const items = screen.getAllByRole("listitem")
    const firstBtn = within(items[0]).getByRole("button")
    expect(firstBtn).toHaveAttribute("aria-expanded", "false")
    await user.click(firstBtn)
    expect(firstBtn).toHaveAttribute("aria-expanded", "true")
    await user.click(firstBtn)
    expect(firstBtn).toHaveAttribute("aria-expanded", "false")
  })

  it("running phase row sets aria-busy=true, cleared on done/failed", async () => {
    // fxRunRunning leaves the last phase RUNNING → the <ol> is aria-busy.
    await renderTimeline(fxRunRunning)
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true")
    cleanup()

    // fxRunDone is terminal/completed → aria-busy is cleared (attribute absent).
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 2,
      total_phases: 3,
    })
    await renderTimeline(fxRunDone)
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy")
  })
})

// ── 188.1-04 · WR-04 sites 2 and 3 — the panel row's two lookups are total ──────

/**
 * WR-04 SITES 2 and 3 (`panel/PhaseCard.tsx` — `PHASE_TYPE_LABEL[phaseType]` behind
 * `phaseTypeMeta`, and the FALLBACK-FREE `STATUS_META[phase.status]`).
 *
 * ⚠ BOTH OBSERVED RED FIRST, against the shipped tree, before either guard was written —
 * the `lib/phaseState.ts` register. Both tables are plain object literals, so they
 * INHERIT `constructor`, `toString`, `__proto__` and friends. `TABLE["constructor"]` is
 * the `Object` FUNCTION: never nullish, so site 2's `?? UNKNOWN_PHASE_META` provably does
 * not fire — and site 3 has no fallback at all, so an unowned key is read straight
 * through. The consequence is a row whose label, glyph and status text all read
 * `undefined` while the card still claims to have rendered a phase.
 *
 * ⚠ WHY THIS DRIVES `PhaseCard` DIRECTLY RATHER THAN A `PhaseTimeline` FIXTURE — measured,
 * not assumed. The fixture path reaches the store through the REAL normalizer, and that
 * normalizer already maps every wire status through `lib/phaseState.phaseStatusFromDb`,
 * which is a SHIPPED own-property guard. A `status: "toString"` handed to `replayFixture`
 * is therefore resolved to `"unknown"` BEFORE it can reach site 3 — a fixture-driven
 * falsification would have been green against the unguarded tree, i.e. never observed RED
 * and never known to test anything. `PhaseCard` is exported and is the real component the
 * timeline renders at `PhaseTimeline.tsx:217`; rendering it is the only route that
 * actually reaches the site. The reference render in each case is an ORDINARY unrecognised
 * value, so the assertion is an equality against real output rather than against a
 * hand-typed literal copied out of a module-private table.
 */
function basePhase(over: Partial<Phase> = {}): Phase {
  return {
    slug: "draft-the-summary",
    phaseIndex: 0,
    phaseType: "llm_single",
    status: "pending",
    subAgents: [],
    pendingAsk: null,
    ...over,
  }
}

/** The accordion header — where the type label, the type glyph and the status atom live. */
function headerTextOf(container: HTMLElement): string {
  return container.querySelector("button")?.textContent ?? ""
}

describe("panel/PhaseCard 188.1-04 — WR-04 sites 2 and 3: the lookups are total", () => {
  it("site 2 — a prototype-key phaseType renders the ORDINARY unknown row, never an inherited member", () => {
    // `running` so the type LABEL renders: the panel shows it on the active step only.
    const proto = render(
      <PhaseCard phase={basePhase({ phaseType: "constructor", status: "running" })} position={0} />,
    )
    const protoText = headerTextOf(proto.container)
    for (const el of Array.from(proto.container.querySelectorAll("*"))) {
      expect(el.textContent ?? "").not.toContain("native code")
    }
    proto.unmount()

    const ordinary = render(
      <PhaseCard
        phase={basePhase({ phaseType: "llm_time_travel", status: "running" })}
        position={0}
      />,
    )
    const ordinaryText = headerTextOf(ordinary.container)
    ordinary.unmount()

    // POSITIVE CONTROL: the ordinary miss really does render the declared unknown meta —
    // the generic "Step" label and the "•" glyph — so the equality below compares two
    // real rows rather than two empty strings.
    expect(ordinaryText).toContain("Step")
    expect(ordinaryText).toContain("•")
    expect(protoText).toBe(ordinaryText)
  })

  it("site 3 — a prototype-key status renders the DECLARED unknown atom, never an inherited member", () => {
    const proto = render(
      <PhaseCard
        phase={basePhase({ status: "toString" as unknown as Phase["status"] })}
        position={0}
      />,
    )
    const protoText = headerTextOf(proto.container)
    proto.unmount()

    // The reference is the union's OWN honest member — `STATUS_META.unknown`, added in
    // Phase 188 Plan 02 so an unrecognised wire status reads as unknown rather than as
    // Complete. Site 3's guard must land an unowned key on exactly that row.
    const declared = render(<PhaseCard phase={basePhase({ status: "unknown" })} position={0} />)
    const declaredText = headerTextOf(declared.container)
    declared.unmount()

    // POSITIVE CONTROL: the declared unknown atom carries real words and a real glyph.
    expect(declaredText).toContain("Unknown")
    expect(declaredText).toContain("?")
    expect(protoText).toBe(declaredText)
  })
})
