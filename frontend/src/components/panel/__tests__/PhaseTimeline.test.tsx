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

import { replayFixture, resetStore } from "./replayHarness"
// 189-08: the store the timeline reads, seeded directly for the announcer cases. The
// fixture wire path cannot carry the new status without a producer that emits it, and the
// announcer is a property of the RENDER, not of the demux. Its own import line — the same
// ADDED-lines rule the 188.1-04 import above records.
import { useStreamsStore } from "@/stores/streamsStore"
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

// ── 189-08 · CONN-01 / D-07 — the panel's own word for the governed not-sent terminal ──

/**
 * D-07 requires the not-sent state to be distinct from passed and done AT EVERY SURFACE it
 * renders. This is the DEVELOPER PANEL's surface, and it speaks the panel's own harness
 * vocabulary (`Not sent`), not the canvas's business sentence — two vocabularies, one
 * derivation, which is `lib/phaseState.ts`'s shipped rule and not a slip.
 *
 * ⚠ EXACT-MATCH ASSERTIONS THROUGHOUT, deliberately. The canvas's word for this state
 * shares the prefix `"Not "` with a shipped reading, so a `toContain("Not")` here would be
 * ambiguous the moment anyone reads across surfaces. Non-collision is asserted as string
 * INEQUALITY against every word this panel already ships.
 *
 * The status atom is read out of the header rather than by importing `STATUS_META`, which
 * is module-private — the same constraint `lib/phaseState.test.ts:80-85` records. Reading
 * the rendered DOM also measures the thing that matters: what a person is actually told.
 */
/** The status atom's [glyph, text] as rendered — the `ml-auto` span in the header. */
function statusAtomOf(container: HTMLElement): [string, string] {
  const atom = container.querySelector("button span.ml-auto")
  const parts = Array.from(atom?.children ?? []).map((el) => el.textContent ?? "")
  return [parts[0] ?? "", parts[1] ?? ""]
}

/** Every status word this panel already ships, for the D-07 non-collision assertion. */
const SHIPPED_PANEL_WORDS = [
  "Locked",
  "Running",
  "Complete",
  "Failed",
  "Attempt",
  "Skipped",
  "Unknown",
]

describe("panel/PhaseCard 189-08 — the not-sent terminal has its OWN word and glyph", () => {
  it("renders the declared row: the ↛ glyph and the exact text `Not sent`", () => {
    const { container } = render(
      <PhaseCard phase={basePhase({ status: "recorded-not-sent" })} position={0} />,
    )
    const [glyph, text] = statusAtomOf(container)
    expect(text).toBe("Not sent")
    expect(glyph).toBe("↛")
    // POSITIVE CONTROL for the reader itself — a shipped row is read the same way, so the
    // two assertions above are measuring the atom and not an empty selector.
    const done = render(<PhaseCard phase={basePhase({ status: "done" })} position={0} />)
    expect(statusAtomOf(done.container)).toStrictEqual(["✓", "Complete"])
  })

  it("collides with NO shipped panel word — D-07's binding constraint, asserted exactly", () => {
    const { container } = render(
      <PhaseCard phase={basePhase({ status: "recorded-not-sent" })} position={0} />,
    )
    const [glyph, text] = statusAtomOf(container)
    for (const word of SHIPPED_PANEL_WORDS) {
      expect(text, `the not-sent word must not be ${word}`).not.toBe(word)
    }
    // …and specifically not the two D-07 names: it must not read as success, and it must
    // not be confusable with the state that is still under way.
    expect(text).not.toBe("Complete")
    expect(text).not.toBe("Running")
    // The GLYPH is distinct too — a shared glyph would re-collide what the words separate.
    // `⊘` is the one it would plausibly have reused; it already means CANCELLED elsewhere.
    expect(glyph).not.toBe("⊘")
    expect(glyph).not.toBe("✓")
    // POSITIVE CONTROL — the comparison really can find equality, so seven inequalities
    // above are seven measurements.
    const doneCard = render(<PhaseCard phase={basePhase({ status: "done" })} position={0} />)
    expect(SHIPPED_PANEL_WORDS).toContain(statusAtomOf(doneCard.container)[1])
  })

  it("keeps the fail-closed floor: an INHERITED key still reads Unknown, not Not sent", () => {
    // The growth must not have widened what the WR-04 guard lets through. `STATUS_META`
    // gained a key; its own-property guard is what stops an inherited name resolving to a
    // FUNCTION, and the fallback is still the declared `unknown` row — never the new one,
    // and never a claim of success.
    const proto = render(
      <PhaseCard
        phase={basePhase({ status: "constructor" as unknown as Phase["status"] })}
        position={0}
      />,
    )
    const [protoGlyph, protoText] = statusAtomOf(proto.container)
    expect(protoText).toBe("Unknown")
    expect(protoText).not.toBe("Not sent")
    expect(protoGlyph).not.toBe("↛")
  })

  it("DECLINES a seventh PHASE_TYPE_LABEL entry — the 7th phase_type reads as the generic Step", () => {
    // Phase 189 deliberately added no row for its new `phase_type`. The declination is
    // PINNED here rather than merely commented: adding a seventh entry makes this RED.
    // `running` so the type label renders — the panel shows it on the active step only.
    const seventh = render(
      <PhaseCard
        phase={basePhase({ phaseType: "external_action", status: "running" })}
        position={0}
      />,
    )
    const seventhText = headerTextOf(seventh.container)
    seventh.unmount()

    const ordinary = render(
      <PhaseCard phase={basePhase({ phaseType: "llm_time_travel", status: "running" })} position={0} />,
    )
    const ordinaryText = headerTextOf(ordinary.container)
    ordinary.unmount()

    // POSITIVE CONTROL: the generic row really does render the declared unknown meta.
    expect(ordinaryText).toContain("Step")
    expect(ordinaryText).toContain("•")
    expect(seventhText).toBe(ordinaryText)
  })
})

/**
 * The announcer is the SILENT consumer — `milestoneFor` is a switch with a `default:` arm,
 * so a widened `Phase["status"]` produces no typecheck error there and a screen-reader user
 * would simply be told nothing when the step reached its terminal. It was found from a
 * written list of consumers, not from a compiler run, and it is pinned here for that reason.
 *
 * Driven through the REAL `PhaseTimeline` over the REAL store rather than by calling the
 * private switch: the announcer only writes on a transition EDGE for the ACTIVE phase, so a
 * unit call would have proved the sentence exists without proving it is ever spoken.
 */
describe("panel/PhaseTimeline 189-08 — the announcer states the not-sent terminal", () => {
  it("announces `not sent` for the new terminal, and never `complete`", async () => {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, [
      { slug: "draft", phaseIndex: 0, phaseType: "llm_single", status: "done", subAgents: [], pendingAsk: null },
      { slug: "notify", phaseIndex: 1, phaseType: "external_action", status: "recorded-not-sent", subAgents: [], pendingAsk: null },
    ])
    render(<PhaseTimeline threadId={THREAD} />)

    const announcer = await screen.findByRole("status")
    expect(announcer.textContent).toBe("Phase 2 of 2, notify, not sent")
    expect(announcer.textContent).not.toContain("complete")
  })

  it("POSITIVE CONTROL — the same seam announces `complete` for a done terminal", async () => {
    // Without this, the case above is consistent with an announcer that says whatever the
    // last arm returns. The two sentences must differ, in the same shipped pattern.
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, [
      { slug: "draft", phaseIndex: 0, phaseType: "llm_single", status: "done", subAgents: [], pendingAsk: null },
      { slug: "notify", phaseIndex: 1, phaseType: "external_action", status: "done", subAgents: [], pendingAsk: null },
    ])
    render(<PhaseTimeline threadId={THREAD} />)

    const announcer = await screen.findByRole("status")
    expect(announcer.textContent).toBe("Phase 2 of 2, notify, complete")
  })

  it("stays SILENT for a status it has no sentence for — the default: arm is the floor", async () => {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, [
      {
        slug: "notify",
        phaseIndex: 0,
        phaseType: "external_action",
        status: "constructor" as unknown as Phase["status"],
        subAgents: [],
        pendingAsk: null,
      },
    ])
    render(<PhaseTimeline threadId={THREAD} />)

    // Silence, not an invented sentence. The announcer element is still PRESENT (the
    // shipped a11y contract) and simply carries nothing — which is the correct claim to
    // make about a state this component cannot name.
    const announcer = await screen.findByRole("status")
    expect(announcer.textContent).toBe("")
    expect(announcer.textContent).not.toContain("complete")
    expect(announcer.textContent).not.toContain("not sent")
  })
})
