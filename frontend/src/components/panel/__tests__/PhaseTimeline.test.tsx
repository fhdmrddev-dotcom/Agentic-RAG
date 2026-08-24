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
// Phase 200-07 widened this line with `act` and `waitFor`: the fetch-authoritative case
// drives a store write and then waits for the RE-READ it triggers, which is an async edge
// this suite had no reason to reach before the readings depended on the durable rows.
import { render, screen, cleanup, within, act, waitFor } from "@testing-library/react"
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
// Phase 200-07: the two panel sources, read for the zero-re-derivation fence. Their own
// import lines — the same ADDED-lines rule the two imports above record.
import timelineSource from "../PhaseTimeline?raw"
import cardSource from "../PhaseCard?raw"
// Phase 200-07: the provider whose MOUNT registers the store's real action bodies
// (`streamsStore.ts:477` declares them all as no-op stubs until then). `replayHarness`
// mounts it for the same reason; the two cases below that drive a live transition need it
// directly, and must not inherit a mount from whichever earlier test happened to run first.
import { StreamsProvider } from "@/providers/StreamsProvider"

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

    // ⚠ THIS CASE ASSERTED `seventhText === ordinaryText` AND WENT RED AT 189-13, and the
    // divergence is CORRECT rather than a regression — so the claim is narrowed to its
    // real subject instead of the byte-identity that happened to hold for one plan.
    //
    // TWO DIFFERENT TABLES answer here. `PHASE_TYPE_LABEL` is the PANEL's own vocabulary
    // and 189 DECLINED a row in it (the table already declined `llm_emit`, and adding a
    // seventh would invent a panel vocabulary for a type the panel never gained one for);
    // that declination still holds and is what this case exists to pin. The 3D MARK is the
    // shared canvas glyph vocabulary — `soulData.PHASE_GLYPHS` — and 189-13 DID land a row
    // there (`outbox-tray`). So the 7th type now renders a real mark beside the generic
    // "Step" label, while a genuinely unknown type still renders the "•" fallback.
    //
    // Byte-identity to an unknown type was therefore never the property; it was a
    // coincidence of the two tables being empty at the same time.
    expect(seventhText).toContain("Step")
    expect(seventhText).not.toContain("External action")
    // The ONLY difference is the leading fallback glyph the unknown type still renders —
    // asserted exactly, so a second divergence (a leaked label, a changed ordinal) fails.
    expect(ordinaryText).toBe(`•${seventhText}`)
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

/**
 * REVIEW FINDING WR-05 — the doing-now line printed the RAW CLIENT STATUS SLUG.
 *
 * The line read ``` `${activePhase.slug} — ${activePhase.status}` ```: the internal
 * `Phase["status"]` member, interpolated straight into copy a user reads. For the six
 * pre-189 members that read tolerably (*notify — running*); for the member 189 ADDED it
 * read **`notify — recorded-not-sent`** — a kebab-case internal identifier, on the one
 * surface in this phase whose entire discipline (D-17) is that the stored slug, the panel
 * word and the canvas sentence are three deliberately DIFFERENT spellings. Every other
 * consumer in the phase routes through a vocabulary table; this line bypassed `STATUS_META`,
 * which already held the correct word.
 *
 * Driven through the REAL `PhaseTimeline` over the REAL store, like the announcer block
 * above, because the doing-now string is composed from the resolved ACTIVE phase — a unit
 * call on the helper would prove the word exists without proving it is what renders.
 */
describe("panel/PhaseTimeline WR-05 — the doing-now line speaks the panel's word, not the slug", () => {
  const activePhases = (status: Phase["status"]) => [
    { slug: "draft", phaseIndex: 0, phaseType: "llm_single", status: "done" as const, subAgents: [], pendingAsk: null },
    { slug: "notify", phaseIndex: 1, phaseType: "external_action", status, subAgents: [], pendingAsk: null },
  ]

  it("the new terminal reads `notify — Not sent`, never the kebab-case member", () => {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, activePhases("recorded-not-sent"))
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    const text = container.textContent ?? ""
    expect(
      text,
      "WR-05: the internal Phase['status'] member reached user-visible copy. The panel " +
        "word lives in STATUS_META and this line bypassed it.",
    ).not.toContain("recorded-not-sent")
    expect(text).toContain("notify — Not sent")
  })

  it("POSITIVE CONTROL — a shipped status still renders its own word, so the routing is not a blanket suppression", () => {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, activePhases("running"))
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    // The pre-189 members read tolerably as raw members too, which is why nothing caught
    // this — so the control asserts the TABLE's capitalised word, not the lowercase member.
    expect(container.textContent).toContain("notify — Running")
  })

  it("an UNRECOGNISED status reads `Unknown`, never the raw string it arrived as", () => {
    resetStore()
    useStreamsStore
      .getState()
      .actions.replacePhasesForThread(THREAD, activePhases("wat_is_this" as unknown as Phase["status"]))
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    const text = container.textContent ?? ""
    expect(text).toContain("notify — Unknown")
    expect(text).not.toContain("wat_is_this")
  })

  it("an INHERITED key reads `Unknown` too — the 188.1-04 own-property guard covers this caller", () => {
    resetStore()
    useStreamsStore
      .getState()
      .actions.replacePhasesForThread(THREAD, activePhases("constructor" as unknown as Phase["status"]))
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    const text = container.textContent ?? ""
    expect(text).toContain("notify — Unknown")
    // Without the guard a prototype key resolves to a FUNCTION and its source leaks.
    expect(text).not.toContain("native code")
  })
})

// ── 194-04 · RUN-01 / D-04 / D-13 — the panel's own word for the STOPPED step ───────
//
// D-13 requires the interrupted phase to read STOPPED — not failed, and not "Unknown".
// This is the DEVELOPER PANEL's surface, and it speaks the panel's own harness word
// (`Stopped`), not the canvas's business sentence — two vocabularies, one derivation,
// `lib/phaseState.ts`'s shipped rule.
//
// ⚠ EXACT-MATCH ASSERTIONS THROUGHOUT, deliberately, for the same reason 189-08 gave one
// block up: the canvas's sentence for this state SHARES ITS FIRST WORD with the panel's,
// so a `toContain("Stopped")` here would pass across both surfaces and prove nothing about
// either. Non-collision is asserted as string INEQUALITY against every word the panel ships.

describe("panel/PhaseCard 194-04 — the stopped terminal has its OWN word and mark", () => {
  it("renders the declared row: the ■ mark and the exact text `Stopped`", () => {
    const { container } = render(
      <PhaseCard phase={basePhase({ status: "cancelled" })} position={0} />,
    )
    const [glyph, text] = statusAtomOf(container)
    expect(text).toBe("Stopped")
    expect(glyph).toBe("■")
    // POSITIVE CONTROL for the reader itself — a shipped row is read the same way, so the
    // two assertions above are measuring the atom and not an empty selector.
    const done = render(<PhaseCard phase={basePhase({ status: "done" })} position={0} />)
    expect(statusAtomOf(done.container)).toStrictEqual(["✓", "Complete"])
  })

  it("collides with NO shipped panel word — the four D-04 refusals, asserted exactly", () => {
    const { container } = render(
      <PhaseCard phase={basePhase({ status: "cancelled" })} position={0} />,
    )
    const [glyph, text] = statusAtomOf(container)
    for (const word of SHIPPED_PANEL_WORDS) {
      expect(text, `the stopped word must not be ${word}`).not.toBe(word)
    }
    // …and specifically not the four D-04 names. Each is a distinct FALSE claim about this
    // step: that it finished, that something went wrong, that it never ran, that we cannot
    // tell. The last is the one that actually shipped before this plan.
    expect(text).not.toBe("Complete")
    expect(text).not.toBe("Failed")
    expect(text).not.toBe("Skipped")
    expect(text).not.toBe("Unknown")
    // …nor 189's terminal, which is a different state with a different cause entirely.
    expect(text).not.toBe("Not sent")
    // The MARK is distinct from every shipped panel glyph too — a shared mark would
    // re-collide what the words separate. Asserted over the whole atom set, not a list.
    const shippedGlyphs = (
      ["pending", "running", "done", "failed", "retrying", "skipped", "recorded-not-sent", "unknown"] as const
    ).map((status) => {
      const r = render(<PhaseCard phase={basePhase({ status })} position={0} />)
      const g = statusAtomOf(r.container)[0]
      r.unmount()
      return g
    })
    // Compared against the mark this row ACTUALLY RENDERED, never a literal re-typed here —
    // a re-typed one would test that the author can copy a character, not that the table's
    // ninth mark is unclaimed.
    expect(shippedGlyphs).not.toContain(glyph)
    expect(glyph).toBe("■")
    // NON-VACUITY: the sweep really did read eight marks, not eight empty strings.
    expect(new Set(shippedGlyphs).size).toBe(8)
    // POSITIVE CONTROL — the comparison really can find equality, so the inequalities
    // above are measurements.
    const doneCard = render(<PhaseCard phase={basePhase({ status: "done" })} position={0} />)
    expect(SHIPPED_PANEL_WORDS).toContain(statusAtomOf(doneCard.container)[1])
  })

  it("keeps the fail-closed floor: an INHERITED key still reads Unknown, not Stopped", () => {
    // The growth must not have widened what the WR-04 own-property guard lets through.
    // `STATUS_META` gained a key; the fallback is still the declared `unknown` row — never
    // the new one, and never a claim of success.
    const proto = render(
      <PhaseCard
        phase={basePhase({ status: "constructor" as unknown as Phase["status"] })}
        position={0}
      />,
    )
    const [protoGlyph, protoText] = statusAtomOf(proto.container)
    expect(protoText).toBe("Unknown")
    expect(protoText).not.toBe("Stopped")
    expect(protoGlyph).not.toBe("■")
  })

  it("a COMPLETED sibling in the same render still reads Complete (V-18, vocabulary layer)", () => {
    // D-07 / D-13: a stopped run KEEPS its completed phases. This is that rule at the
    // vocabulary layer — the two rows are read out of ONE render, so a change that
    // repainted finished steps could not hide behind two separate mounts.
    const done = render(<PhaseCard phase={basePhase({ status: "done" })} position={0} />)
    const stopped = render(<PhaseCard phase={basePhase({ status: "cancelled" })} position={0} />)
    expect(statusAtomOf(done.container)).toStrictEqual(["✓", "Complete"])
    expect(statusAtomOf(stopped.container)).toStrictEqual(["■", "Stopped"])
  })
})

/**
 * THE ANNOUNCER — the consumer `tsc` CANNOT find, hunted from a written list of consumers
 * rather than from a compiler run, exactly as 189's arm was. `milestoneFor` is a switch with
 * a fall-through arm, so the widened `Phase["status"]` produced NO typecheck error there and
 * a screen-reader user would simply have been told nothing when the step reached its
 * terminal. The plan is that written list; this block is its proof.
 *
 * ⚠ THE GAP WAS DRIVEN RED BEFORE THE ARM WAS WRITTEN. Against the un-armed switch this
 * first case failed with `expected '' to be 'Phase 2 of 2, notify, stopped'` — the empty
 * string, i.e. the silence the docblock predicts. Recorded in `194-04-SUMMARY.md`.
 *
 * Driven through the REAL `PhaseTimeline` over the REAL store rather than by calling the
 * private switch: the announcer only writes on a transition EDGE for the ACTIVE phase, so a
 * unit call would have proved the sentence exists without proving it is ever spoken.
 */
describe("panel/PhaseTimeline 194-04 — the announcer states the stopped terminal", () => {
  it("announces `stopped` for the new terminal, and never `complete` or `failed`", async () => {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, [
      { slug: "draft", phaseIndex: 0, phaseType: "llm_single", status: "done", subAgents: [], pendingAsk: null },
      { slug: "notify", phaseIndex: 1, phaseType: "llm_emit", status: "cancelled", subAgents: [], pendingAsk: null },
    ])
    render(<PhaseTimeline threadId={THREAD} />)

    const announcer = await screen.findByRole("status")
    expect(announcer.textContent).toBe("Phase 2 of 2, notify, stopped")
    // It must be SPOKEN — the empty string is what the un-armed switch returned, and it is
    // the failure this case was watched to produce.
    expect(announcer.textContent).not.toBe("")
    expect(announcer.textContent).not.toContain("complete")
    expect(announcer.textContent).not.toContain("failed")
    // …and it ends in the PANEL's own words, never in the internal member spelling.
    expect(announcer.textContent).not.toContain("cancelled")
  })

  it("POSITIVE CONTROL — the same seam announces `complete` for a done terminal", async () => {
    // Without this, the case above is consistent with an announcer that says whatever the
    // last arm returns. The two sentences must differ, in the same shipped pattern.
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, [
      { slug: "draft", phaseIndex: 0, phaseType: "llm_single", status: "done", subAgents: [], pendingAsk: null },
      { slug: "notify", phaseIndex: 1, phaseType: "llm_emit", status: "done", subAgents: [], pendingAsk: null },
    ])
    render(<PhaseTimeline threadId={THREAD} />)

    const announcer = await screen.findByRole("status")
    expect(announcer.textContent).toBe("Phase 2 of 2, notify, complete")
  })

  it("the doing-now line reads `notify — Stopped`, never the internal member", () => {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, [
      { slug: "draft", phaseIndex: 0, phaseType: "llm_single", status: "done", subAgents: [], pendingAsk: null },
      { slug: "notify", phaseIndex: 1, phaseType: "llm_emit", status: "cancelled", subAgents: [], pendingAsk: null },
    ])
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    const text = container.textContent ?? ""
    expect(text).toContain("notify — Stopped")
    // WR-05's rule, inherited: the internal member must not reach user-visible copy. Here
    // the member and the DB slug happen to be spelled the same, so this one assertion
    // covers both — which is a property of the word, not a relaxation of D-17.
    expect(text).not.toContain("— cancelled")
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// Phase 200-07 Task 1 (DES-02 · `200-CHECKLIST.md` §4) — THE PANEL HALF READS THE DURABLE
// TIMINGS, AND IT READS THEM FROM THE FETCH.
//
// ⚠ THE JOIN THIS BLOCK PROVES IS THE ONE `200-02` BOUGHT AND NOBODY HAD CONSUMED. The live
// slice's `Phase` carries NO timestamps at all (`types/index.ts:1018-1082`) — it never has —
// so the per-step readings can only come from `GET /threads/{id}/workflow`'s durable rows.
// That is the FETCH, which is exactly where the project rule puts the truth: *"Realtime is a
// best-effort hint, not a source of truth — always reconcile via fetch"* (D-v2.5-03). A
// terminal run has no stream at all, which is why this component already has a reconcile
// floor and why a stream-fed reading would go blank on precisely the runs a person re-opens.
//
// ⚠ AND THE CLIENT MIRROR OF THAT TRANSPORT WAS MISSING FOUR FIELDS UNTIL THIS PLAN. The
// Python model (`models/thread.py:122-125`) has carried them since `200-02`; `api.ts`'s
// `WorkflowPhaseState` had not, so the wire was sending facts the panel could not declare.
// Measured against the two models, not inferred from a plan's prose.
// ─────────────────────────────────────────────────────────────────────────────────────────
describe("panel/PhaseTimeline 200-07 — the durable per-step readings", () => {
  const T0 = "2026-08-20T12:00:00Z"
  const T12 = "2026-08-20T12:00:12Z"

  /**
   * Seed the live slice.
   *
   * ⚠ MEASURED WHILE WRITING THIS BLOCK, and worth recording rather than working around
   * silently: **`usePhases` mounts `usePanelReconcile`, whose fetcher is `reconcilePhases`
   * — which calls `getThreadWorkflow` and then REPLACES the whole slice.** So on this
   * surface the live slice is itself fetch-derived, and a seed written before render is
   * overwritten by the mount reconcile. That is the shipped design (the reconcile floor),
   * not a defect — but it means a case that seeds and then asserts is, by default, asserting
   * against the MOCK's rows rather than its own seed. Two of the cases below therefore write
   * the slice AFTER the reconcile has settled, through a mounted provider (below).
   */
  function seedSlice(rows: { slug: string; status: Phase["status"] }[]) {
    resetStore()
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD, rows.map(toPhase))
  }

  function toPhase(r: { slug: string; status: Phase["status"] }, i: number): Phase {
    return {
      slug: r.slug,
      phaseIndex: i,
      phaseType: "llm_agent",
      status: r.status,
      subAgents: [],
      pendingAsk: null,
    }
  }

  /**
   * Mount the timeline INSIDE a real `StreamsProvider`.
   *
   * ⚠ REQUIRED, NOT DECORATIVE. `streamsStore.ts:477` declares every action as a no-op stub
   * and the REAL bodies are registered by `StreamsProvider`'s mount effect
   * (`StreamsProvider.tsx:1541`). Without a mounted provider,
   * `actions.replacePhasesForThread` silently does nothing — so a case that "drives a live
   * transition" drives nothing at all and passes against the mock's rows. `replayHarness`
   * mounts the provider for exactly this reason; the cases below that write the slice
   * mid-test do the same rather than inheriting a mount from an earlier test in the file.
   */
  function renderWithProvider() {
    return render(
      <StreamsProvider>
        <PhaseTimeline threadId={THREAD} />
      </StreamsProvider>,
    )
  }

  it("renders a real per-step duration and a real declared count, from the FETCHED rows", async () => {
    seedSlice([{ slug: "gather", status: "done" }])
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 0,
      total_phases: 1,
      phases: [
        {
          slug: "gather",
          phase_index: 0,
          status: "completed",
          started_at: T0,
          completed_at: T12,
          step_count: 312,
          step_noun: "sources",
        },
      ],
    })
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    // `findBy*` because the reading only exists once the fetch resolves — which is the whole
    // point: nothing here is derived from the live slice.
    const timing = await screen.findByTestId("phase-card-timing")
    expect(timing.textContent).toBe("12s")
    expect(container.querySelector('[data-testid="phase-card-count"]')?.textContent).toBe(
      "312 sources",
    )
  })

  it("a step the FETCH has not mentioned renders NO reading — an absence is not `not recorded`", async () => {
    // A live SSE event can add a row the durable read has not caught up with. The honest
    // render of "I hold no row for this slug" is NOTHING — emphatically not `time not
    // recorded`, which claims a row exists whose timestamps are empty. Two different facts.
    resetStore()
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "active",
      current_phase_index: 0,
      total_phases: 2,
      phases: [
        { slug: "gather", phase_index: 0, status: "completed", started_at: T0, completed_at: T12 },
      ],
    })
    const { container } = renderWithProvider()
    await screen.findByTestId("phase-card-timing")

    // ⚠ THE SECOND ROW IS ADDED AFTER THE RECONCILE SETTLES, through the REAL action — a
    // seed written before render would have been replaced by the mount reconcile and this
    // case would then be asserting `1 === 1` about a list that only ever had one row.
    await act(async () => {
      useStreamsStore
        .getState()
        .actions.replacePhasesForThread(THREAD, [
          toPhase({ slug: "gather", status: "done" }, 0),
          toPhase({ slug: "draft", status: "pending" }, 1),
        ])
    })

    // NON-VACUITY: two rows really are rendered…
    await waitFor(() => {
      expect(container.querySelectorAll("ol > li")).toHaveLength(2)
    })
    // …and exactly ONE of them carries a reading. The other is silent.
    expect(container.querySelectorAll('[data-testid="phase-card-timing"]')).toHaveLength(1)
    expect(container.textContent ?? "").not.toContain("time not recorded")
  })

  it("FETCH IS AUTHORITATIVE: a status transition re-reads the durable rows (D-v2.5-03)", async () => {
    // ⚠ WITHOUT THIS THE READING FREEZES AT MOUNT. The timestamps live on the fetched rows
    // and this component fetched exactly once, so a step that STARTS after mount would have
    // its `started_at` arrive on the SSE frame — which drives the slice, not the readings —
    // and the row would sit blank while a person watched. `196` measured the same shape one
    // surface over: a gate with no fetch reconcile HID a shipped control.
    resetStore()
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "active",
      current_phase_index: 0,
      total_phases: 1,
      phases: [{ slug: "gather", phase_index: 0, status: "pending" }],
    })
    renderWithProvider()
    // Settle the mount, then write the slice EXPLICITLY through the real action. ⚠ Driving
    // it here rather than leaning on the mount reconcile is deliberate: the reconcile's
    // `replace` is captured from the store at first render, when it is still the stub, so
    // whether it populates on the first pass is a timing detail — and a case whose SETUP is
    // a race proves nothing about the behaviour under it.
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      useStreamsStore
        .getState()
        .actions.replacePhasesForThread(THREAD, [toPhase({ slug: "gather", status: "pending" }, 0)])
    })
    await waitFor(() => {
      expect(screen.getByTestId("phase-card-timing").getAttribute("data-timing-kind")).toBe(
        "not-started",
      )
    })

    // The step starts. The slice moves first (the hint); the fetch must follow (the truth).
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "active",
      current_phase_index: 0,
      total_phases: 1,
      phases: [{ slug: "gather", phase_index: 0, status: "active", started_at: T0 }],
    })
    await act(async () => {
      useStreamsStore
        .getState()
        .actions.replacePhasesForThread(THREAD, [toPhase({ slug: "gather", status: "running" }, 0)])
    })

    // ⚠ THE ASSERTION IS THE RENDERED READING, NOT A CALL COUNT, and that is deliberate. A
    // call count would pass against a component that re-fetched and then ignored the answer;
    // the reading can only move if the durable rows were re-read AND consumed. It is also
    // the thing a person actually sees change.
    await waitFor(() => {
      expect(screen.getByTestId("phase-card-timing").getAttribute("data-timing-kind")).toBe(
        "running",
      )
    })
    // …and it now carries a real figure, anchored on the SERVER's `started_at`.
    expect(screen.getByTestId("phase-card-timing").textContent).toMatch(/\d/)
  })

  it("RS-MNR-02: an `active` row under a TERMINAL run reads `did not finish`, never a clock", async () => {
    // The residual is INHERITED, not introduced here: `harness_engine.py:1698-1706` only
    // terminalizes the interrupted phase on a cancellation, so a crash leaves an `active`
    // row under a `failed` run. Rendered as a tick it would run forever — `BUG-260610-01`'s
    // symptom, on the surface built to remove it.
    seedSlice([{ slug: "gather", status: "running" }])
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "failed",
      current_phase_index: 0,
      total_phases: 1,
      phases: [{ slug: "gather", phase_index: 0, status: "active", started_at: T0 }],
    })
    render(<PhaseTimeline threadId={THREAD} />)

    const timing = await screen.findByTestId("phase-card-timing")
    expect(timing.getAttribute("data-timing-kind")).toBe("unfinished")
    expect(timing.textContent).not.toMatch(/\d/)
  })

  it("`skipped` and a HISTORIC row are two different readings in ONE render", async () => {
    // ⚠ ASSERTED IN ONE RENDER RATHER THAN TWO, deliberately. Two separate renders can both
    // be "correct" while a single list still collapses them — and a list is what a person
    // actually reads.
    seedSlice([
      { slug: "gather", status: "skipped" },
      { slug: "draft", status: "done" },
    ])
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 1,
      total_phases: 2,
      phases: [
        { slug: "gather", phase_index: 0, status: "skipped" },
        // Terminal with BOTH timestamps null — a row written before migration 121 existed.
        { slug: "draft", phase_index: 1, status: "completed", started_at: null, completed_at: null },
      ],
    })
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="phase-card-timing"]')).toHaveLength(2)
    })
    const readings = Array.from(
      container.querySelectorAll('[data-testid="phase-card-timing"]'),
    ).map((el) => el.textContent ?? "")
    expect(readings[0].length).toBeGreaterThan(0)
    expect(readings[1].length).toBeGreaterThan(0)
    expect(readings[0]).not.toBe(readings[1])
  })

  it("a `constructor`-slugged phase renders no function and does not blank the row", async () => {
    // ⚠ LIVE, NOT THEORETICAL. `workflow_phases.slug` is unconstrained `text` (migration 121
    // declined `SEED-143`'s CHECK with a recorded trigger), and `200-04` found the eighth
    // live sink of this class in this tree — where React REFUSED the function child and the
    // label rendered as NOTHING AT ALL, which is worse than the predicted garbage string
    // because nothing appears on screen to say anything went wrong.
    seedSlice([{ slug: "constructor", status: "done" }])
    mockGetThreadWorkflow.mockResolvedValue({
      mode: "harness",
      definition_name: "X",
      run_status: "completed",
      current_phase_index: 0,
      total_phases: 1,
      phases: [
        { slug: "constructor", phase_index: 0, status: "completed", started_at: T0, completed_at: T12 },
      ],
    })
    const { container } = render(<PhaseTimeline threadId={THREAD} />)

    const timing = await screen.findByTestId("phase-card-timing")
    expect(timing.textContent).toBe("12s")
    // The row itself still renders its identity — the blank-row failure mode, asserted.
    expect(container.textContent ?? "").toContain("constructor")
  })

  it("holds NO duration derivation of its own — both panel files read the ONE resolver", () => {
    // Req-8's shape, one surface along: the panel and the run page must not be able to
    // disagree about a duration, and the only mechanical guarantee of that is that neither
    // subtracts a timestamp. A second derivation here would look like a small convenience
    // and would be the disagreement's first day.
    const DATE_MATH = /new Date\([^)]*\)\s*[-+]\s*new Date\(/
    expect(timelineSource.length).toBeGreaterThan(1000)
    expect(cardSource.length).toBeGreaterThan(1000)
    expect(timelineSource).not.toMatch(DATE_MATH)
    expect(cardSource).not.toMatch(DATE_MATH)
    // …and each really does import the shared resolver, so the absence above is "it moved"
    // rather than "it vanished".
    expect(timelineSource).toContain("phaseDuration")
    expect(cardSource).toContain("phaseDuration")
    // POSITIVE CONTROL — the needle finds the shape it forbids.
    expect("const ms = new Date(b) - new Date(a)").toMatch(DATE_MATH)
  })
})
