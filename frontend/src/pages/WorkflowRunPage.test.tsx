/**
 * Phase 188 Plan 08 Task 3 (RUNVIZ-01 / RUNVIZ-02 / RUNVIZ-03 — SPEC Req 4 / Req 6 /
 * Req 7) — the run-reading half of the run surface.
 *
 * This spec exercises the PAGE's composition: the `phase_index` join, the terminal
 * re-open with no live stream, the reconcile identity property, the elapsed contract and
 * the total run-band map. `WorkflowCanvas` is stubbed as a leaf that renders whatever the
 * page's `runState(slug)` returned, so this suite needs no `ReactFlowProvider` and the
 * node PAINT stays fenced where it already is (`PhaseNodeCard.test.tsx` /
 * `PhaseNode.test.tsx`).
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react"
import type { Phase } from "@/types"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

// ── The api surface. `ApiError` is declared INSIDE the factory (never imported from
//    the real module) so the page's `err instanceof ApiError` branch is exercised
//    against the very class this suite throws. ──
const getWorkflowRun = vi.fn()

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    readonly status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  }
  return {
    ApiError,
    getWorkflowRun: (...a: unknown[]) => getWorkflowRun(...(a as [string])),
  }
})

// ── The live slice. The page is the ONLY component on this surface that touches the
//    stream, so exactly one hook is mocked. ──
const usePhases = vi.fn()
vi.mock("@/providers/StreamsProvider", () => ({
  usePhases: (...a: unknown[]) => usePhases(...(a as [string | null])),
}))

// ── The canvas leaf-stub: it renders what the page HANDED it and nothing else, so a
//    reading in this DOM is a reading the page computed. ──
vi.mock("@/components/workflows/WorkflowCanvas", () => ({
  WorkflowCanvas: ({
    phases,
    runState,
    editable,
    selectedSlug,
  }: {
    phases: PhaseSpecJSON[]
    runState?: (slug: string) => { reading: string; label: string } | undefined
    editable?: boolean
    selectedSlug: string | null
  }) => (
    <div
      data-testid="canvas-stub"
      data-editable={String(editable)}
      data-selected={String(selectedSlug)}
    >
      {phases.map((p) => (
        <div key={p.slug} data-testid={`node-${p.slug}`}>
          <span data-testid={`reading-${p.slug}`}>{runState?.(p.slug)?.reading ?? "NONE"}</span>
          <span data-testid={`label-${p.slug}`}>{runState?.(p.slug)?.label ?? "NONE"}</span>
        </div>
      ))}
    </div>
  ),
}))

import { WorkflowRunPage } from "./WorkflowRunPage"
import pageSource from "./WorkflowRunPage?raw"
import { ApiError } from "@/lib/api"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A realistic 3-step contract-renewal spine — real slugs, real author names, so a join
 *  keyed on the wrong field has somewhere visible to go wrong. */
const SPECS: PhaseSpecJSON[] = [
  {
    slug: "gather-contracts",
    phase_index: 0,
    name: "Find the supplier contracts",
    config: { phase_type: "llm_agent" },
  },
  {
    slug: "draft-letter",
    phase_index: 1,
    name: "Draft the renewal letter",
    config: { phase_type: "llm_agent" },
  },
  {
    slug: "final-check",
    phase_index: 2,
    name: "Check it over",
    config: { phase_type: "llm_human_input" },
  },
]

const SLUGS = SPECS.map((s) => s.slug)

interface RunLike {
  id: string
  thread_id: string
  definition_id: string
  workflow_name: string
  workflow_slug: string
  workflow_version: number
  status: string
  created_at: string | null
  claimed_at: string | null
  updated_at: string | null
  definition: { phases: PhaseSpecJSON[] } | null
  phases: { slug: string; phase_index: number; status: string; phase_type: string | null }[]
}

const CLAIMED = "2026-08-05T14:03:11Z"
const UPDATED = "2026-08-05T14:09:52Z"

function mkRun(overrides: Partial<RunLike> = {}): RunLike {
  return {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Supplier contract renewals",
    workflow_slug: "supplier-contract-renewals",
    workflow_version: 4,
    status: "active",
    created_at: "2026-08-05T14:03:00Z",
    claimed_at: CLAIMED,
    updated_at: UPDATED,
    definition: { phases: SPECS },
    phases: [
      { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
      { slug: "draft-letter", phase_index: 1, status: "active", phase_type: "llm_agent" },
      { slug: "final-check", phase_index: 2, status: "pending", phase_type: "llm_human_input" },
    ],
    ...overrides,
  }
}

/** One live-slice row. `slug` is a parameter on purpose — the join tests hand it
 *  positional PLACEHOLDERS, which is exactly what the live reconcile skeleton can emit. */
function mkPhase(
  phaseIndex: number,
  status: Phase["status"],
  slug: string,
  extra: Partial<Phase> = {},
): Phase {
  return {
    slug,
    phaseIndex,
    phaseType: "llm_agent",
    status,
    subAgents: [],
    pendingAsk: null,
    ...extra,
  }
}

const reconcile = vi.fn()

function setLiveSlice(data: Phase[]) {
  usePhases.mockReturnValue({ data, isLoading: false, error: null, reconcile })
}

function renderPage(props: Partial<Parameters<typeof WorkflowRunPage>[0]> = {}) {
  const onBack = vi.fn()
  const onOpenThread = vi.fn()
  const utils = render(
    <TechnicalNamesProvider>
      <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} {...props} />
    </TechnicalNamesProvider>,
  )
  return { ...utils, onBack, onOpenThread }
}

/** Every visible node reading, read off the DOM the stub produced — never typed. */
function readings(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slug of SLUGS) out[slug] = screen.getByTestId(`reading-${slug}`).textContent ?? ""
  return out
}

function labels(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slug of SLUGS) out[slug] = screen.getByTestId(`label-${slug}`).textContent ?? ""
  return out
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  setLiveSlice([])
  getWorkflowRun.mockResolvedValue(mkRun())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── 1. Terminal re-open with NO live stream (SPEC Req 7) ──────────────────────

describe("WorkflowRunPage — a terminal run re-opens by id with no live stream", () => {
  it("seeds every definition node from the inline run.phases array", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({
        status: "completed",
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: null },
          { slug: "draft-letter", phase_index: 1, status: "completed", phase_type: null },
          { slug: "final-check", phase_index: 2, status: "skipped", phase_type: null },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(readings()).toEqual({
      "gather-contracts": "done",
      "draft-letter": "done",
      "final-check": "skipped",
    })
  })

  it("puts the terminal seed through the SAME derivation: completed reads Complete, pending reads Not started", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({
        status: "completed",
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: null },
          { slug: "draft-letter", phase_index: 1, status: "pending", phase_type: null },
          { slug: "final-check", phase_index: 2, status: "pending", phase_type: null },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("canvas-stub")
    // The WORDS come from the shared vocabulary, not from this suite's expectations of it.
    expect(labels()["gather-contracts"]).toBe("Complete")
    expect(labels()["draft-letter"]).toBe("Not started")
  })

  it("renders the spine with no stream at all — the live slice is empty and every node still has a reading", async () => {
    setLiveSlice([])
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    for (const slug of SLUGS) expect(readings()[slug]).not.toBe("NONE")
  })

  it("renders the canvas read-only and with nothing selected", async () => {
    renderPage()
    const stub = await screen.findByTestId("canvas-stub")
    expect(stub.getAttribute("data-editable")).toBe("false")
    expect(stub.getAttribute("data-selected")).toBe("null")
  })
})

// ── 2. The join is by INDEX, not by slug (D-188-01) ───────────────────────────

describe("WorkflowRunPage — the join key is phase_index, never the slug", () => {
  it("reads every definition node correctly when the live slice carries PLACEHOLDER slugs", async () => {
    // The live reconcile skeleton emits `phase-{i}` for rows the harness has not started.
    // A slug-keyed join misses all three of these; an index-keyed one cannot.
    setLiveSlice([
      mkPhase(0, "done", "phase-0"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "phase-2"),
    ])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(readings()).toEqual({
      "gather-contracts": "done",
      "draft-letter": "running",
      "final-check": "not-started",
    })
  })

  it("is not fooled by a live row whose slug matches a DIFFERENT definition step", async () => {
    // Index 0 carries the LAST step's slug. Keyed on slug, `final-check` would read
    // `done` and `gather-contracts` would read `not-started` — exactly inverted.
    setLiveSlice([
      mkPhase(0, "done", "final-check"),
      mkPhase(1, "running", "phase-1"),
      mkPhase(2, "pending", "phase-2"),
    ])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(readings()["gather-contracts"]).toBe("done")
    expect(readings()["final-check"]).toBe("not-started")
  })

  it("threads emitFailure, so a failed step reports the RIGHT one of three clauses", async () => {
    // 188-07's falsification E is the receipt: with the thread cut, every failed node
    // reads the weakest of the three claims and a real emit failure is under-reported.
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "failed", "draft-letter", { emitFailure: "citation_gate_rejected" }),
      mkPhase(2, "pending", "final-check"),
    ])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(labels()["draft-letter"]).toBe("Failed — its answer did not pass the required checks")
  })

  it("a failed step with no emitFailure falls to the weakest claim, and only then", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "failed", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(labels()["draft-letter"]).toBe("Failed — this step did not finish")
  })

  it("gives a definition step with no matching row `not-started`, never `unknown`", async () => {
    setLiveSlice([mkPhase(0, "running", "phase-0")])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(readings()["final-check"]).toBe("not-started")
    expect(readings()["final-check"]).not.toBe("unknown")
  })
})

// ── 3. Mid-run reconcile identity (SPEC Req 4) ────────────────────────────────

describe("WorkflowRunPage — a reconcile leaves every visible node reading identical", () => {
  /**
   * The live slice, and the slice a reconcile over the SAME durable rows produces. The
   * post-reconcile side is built the way `reconcilePhases`' durable branch builds it —
   * DB-native statuses through the shared derivation — so the two sides are genuinely
   * different inputs that must land on the same readings.
   */
  const live: Phase[] = [
    mkPhase(0, "done", "gather-contracts"),
    // `retrying` is representable LIVE and is NOT a member of the DB CHECK constraint,
    // so a reconcile can never produce it. It must therefore read the same as what a
    // reconcile CAN produce (`active` → `running`) — the canvas never paints a state a
    // reload cannot restore.
    mkPhase(1, "retrying", "draft-letter"),
    mkPhase(2, "pending", "final-check"),
  ]
  const afterReconcile: Phase[] = [
    mkPhase(0, "done", "gather-contracts"),
    mkPhase(1, "running", "draft-letter"),
    mkPhase(2, "pending", "final-check"),
  ]

  it("every reading is identical before and after", async () => {
    setLiveSlice(live)
    const { rerender, onBack, onOpenThread } = renderPage()
    await screen.findByTestId("canvas-stub")
    const before = readings()

    setLiveSlice(afterReconcile)
    rerender(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    await waitFor(() => expect(screen.getByTestId("canvas-stub")).toBeTruthy())
    expect(readings()).toEqual(before)
  })

  it("a retrying phase reads Running both before and after — the collapsed state survives", async () => {
    setLiveSlice(live)
    const { rerender, onBack, onOpenThread } = renderPage()
    await screen.findByTestId("canvas-stub")
    expect(labels()["draft-letter"]).toBe("Running")

    setLiveSlice(afterReconcile)
    rerender(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    await waitFor(() => expect(screen.getByTestId("canvas-stub")).toBeTruthy())
    expect(labels()["draft-letter"]).toBe("Running")
  })

  it("calls the reconcile its own hook returns when the tab wakes — this page closes that locally", async () => {
    setLiveSlice(live)
    renderPage()
    await screen.findByTestId("canvas-stub")
    reconcile.mockClear()
    fireEvent(window, new Event("visibilitychange"))
    expect(reconcile).toHaveBeenCalled()
  })
})

// ── 4. The elapsed contract (D-188-18) ────────────────────────────────────────

describe("WorkflowRunPage — the elapsed figure names the field it derives from", () => {
  it("a live run renders a number AND the literal anchor phrase", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: CLAIMED }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("since it started processing")
    expect(slot).toMatch(/\d+[smh]/)
  })

  it("a terminal run reads `Ran for` and names both ends of the window", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({ status: "completed", claimed_at: CLAIMED, updated_at: UPDATED }),
    )
    renderPage()
    await screen.findByTestId("canvas-stub")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("Ran for")
    expect(slot).toContain("from when it started processing to its last update")
    // 14:03:11 → 14:09:52 is 6m 41s, frozen — never a live tick.
    expect(slot).toContain("6m 41s")
  })

  it("claimed_at == null renders `Waiting to start` and NO number at all", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("Waiting to start")
    // No digit followed by a unit anywhere in the elapsed slot — not even "0s".
    expect(slot).not.toMatch(/\d+\s*[smh]\b/)
    // POSITIVE CONTROL — the pattern above really does match the shape it forbids, so
    // its absence is a measurement and not a tautology.
    expect("4m 12s since it started processing").toMatch(/\d+\s*[smh]\b/)
  })

  it("the ⌥ reveal exposes the literal claimed_at, and the plain view does not", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.queryByTestId("run-elapsed-technical")).toBeNull()

    cleanup()
    window.localStorage.setItem("technical-names", "true")
    renderPage()
    await screen.findByTestId("canvas-stub")
    const technical = screen.getByTestId("run-elapsed-technical").textContent ?? ""
    expect(technical).toContain("claimed_at")
    expect(technical).toContain(CLAIMED)
  })

  it("the ⌥ reveal says `claimed_at null` rather than inventing a time", async () => {
    window.localStorage.setItem("technical-names", "true")
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-elapsed-technical").textContent).toContain("claimed_at null")
  })
})

// ── 5. The run band is a TOTAL function over workflow_runs.status ─────────────

describe("WorkflowRunPage — the run band is total", () => {
  const cases: [string, string][] = [
    ["active", "Running"],
    ["paused", "Paused for your answer"],
    ["cap_paused", "Paused at the step limit"],
    ["completed", "Complete"],
    ["failed", "Failed"],
    ["cancelled", "Cancelled"],
  ]

  for (const [status, needle] of cases) {
    it(`renders the ${status} band`, async () => {
      getWorkflowRun.mockResolvedValue(mkRun({ status }))
      renderPage()
      await screen.findByTestId("canvas-stub")
      expect(screen.getByTestId("run-band").textContent).toContain(needle)
    })
  }

  it("an `active` run that was never claimed reads Waiting to start, not Running", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain("Waiting to start")
    expect(band).not.toContain("Running")
  })

  it("an UNRECOGNISED status reads State unknown and NEVER Complete", async () => {
    // A value from a newer server. The failure this asserts against is a fail-OPEN:
    // reporting a run we cannot read as finished successfully.
    getWorkflowRun.mockResolvedValue(mkRun({ status: "quiesced" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain("State unknown")
    expect(band).not.toContain("Complete")
  })

  it("an inherited prototype key is not a status either", async () => {
    // `constructor` / `toString` are inherited by every object literal, so a band keyed
    // on `TABLE[status] ?? fallback` would hand back a FUNCTION here instead of firing
    // its fallback (measured in 188-05).
    getWorkflowRun.mockResolvedValue(mkRun({ status: "constructor" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-band").textContent).toContain("State unknown")
  })

  it("names the failing step by TITLE, never by slug or index", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "failed", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkRun({ status: "failed" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain('Failed at "Draft the renewal letter"')
    expect(band).not.toContain("draft-letter")
    expect(band).not.toMatch(/\bPhase 1\b/)
  })

  it("cap_paused states the fact and offers NO control — the band holds nothing focusable", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "cap_paused" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const band = screen.getByTestId("run-band")
    expect(band.textContent).toContain("Paused at the step limit")
    expect(band.querySelectorAll("button, a, [tabindex], input, select")).toHaveLength(0)
    // POSITIVE CONTROL — the selector really does find a control when one exists.
    const probe = document.createElement("div")
    probe.innerHTML = "<button>x</button>"
    expect(probe.querySelectorAll("button, a, [tabindex], input, select")).toHaveLength(1)
  })
})

// ── 6. No live-region denial of service ──────────────────────────────────────

describe("WorkflowRunPage — the polite region carries the sentence, not the clock", () => {
  it("the ticking number is not inside the polite live region", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: CLAIMED }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const band = screen.getByTestId("run-band")
    expect(band.getAttribute("aria-live")).toBe("polite")
    expect(band.getAttribute("aria-atomic")).toBe("true")
    // The state sentence only — no digit-plus-unit anywhere in the announced content.
    expect(band.textContent ?? "").not.toMatch(/\d+\s*[smh]\b/)
    // ...while the number IS on the surface, in an aria-hidden sibling.
    const hidden = band.parentElement?.querySelector('[aria-hidden="true"]')
    expect(hidden?.textContent ?? "").toMatch(/\d+\s*[smh]\b/)
  })

  it("a failed run raises exactly one assertive notice", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "failed" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const alerts = screen.getAllByTestId("run-alert")
    expect(alerts).toHaveLength(1)
    expect(alerts[0].getAttribute("role")).toBe("alert")
    await waitFor(() => expect(alerts[0].textContent ?? "").toContain("Failed"))
  })

  it("a healthy run raises no assertive notice at all", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-alert").textContent).toBe("")
  })

  it("marks the canvas region busy while the run is live and calm once it is terminal", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-canvas-region").getAttribute("aria-busy")).toBe("true")

    cleanup()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-canvas-region").getAttribute("aria-busy")).toBe("false")
  })
})

// ── 7. Loading, error and the two navigations ────────────────────────────────

describe("WorkflowRunPage — loading and error states", () => {
  it("renders the loading copy and NO skeleton spine", async () => {
    let resolve!: (v: RunLike) => void
    getWorkflowRun.mockReturnValue(
      new Promise<RunLike>((r) => {
        resolve = r
      }),
    )
    renderPage()
    expect(screen.getByText("Opening the run…")).toBeTruthy()
    expect(screen.queryByTestId("canvas-stub")).toBeNull()
    await act(async () => {
      resolve(mkRun())
    })
    await screen.findByTestId("canvas-stub")
  })

  it("a 404 renders the not-available copy and goes back", async () => {
    getWorkflowRun.mockRejectedValue(new ApiError("nope", 404))
    const { onBack } = renderPage()
    await screen.findByText("That run isn't available.")
    expect(
      screen.getByText("It may have been deleted, or it belongs to another account."),
    ).toBeTruthy()
    // A 404 is BOTH "gone" and "not yours" — no retry is offered for either.
    expect(screen.queryByText("Try again")).toBeNull()
    fireEvent.click(screen.getByText("‹ Back to Workflows"))
    expect(onBack).toHaveBeenCalled()
  })

  it("a 5xx renders the our-side copy and offers a retry that re-reads the SAME id", async () => {
    getWorkflowRun.mockRejectedValue(new ApiError("boom", 500))
    renderPage()
    await screen.findByText("We couldn't load this run.")
    expect(
      screen.getByText("Something went wrong on our side. Nothing about the run has changed."),
    ).toBeTruthy()
    getWorkflowRun.mockResolvedValue(mkRun())
    fireEvent.click(screen.getByText("Try again"))
    await screen.findByTestId("canvas-stub")
    expect(getWorkflowRun).toHaveBeenCalledTimes(2)
    expect(getWorkflowRun.mock.calls[1][0]).toBe("run-1")
  })

  it("the header carries the workflow identity and the thread seam", async () => {
    const { onOpenThread } = renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByText("Supplier contract renewals")).toBeTruthy()
    expect(screen.getByText("v4")).toBeTruthy()
    fireEvent.click(screen.getByText("Open the chat thread"))
    expect(onOpenThread).toHaveBeenCalledWith("thread-1")
  })

  it("a stale response can never land on a newly-opened run", async () => {
    // The first read resolves LATE, after the page has been pointed at another run.
    let resolveFirst!: (v: RunLike) => void
    getWorkflowRun.mockReturnValueOnce(
      new Promise<RunLike>((r) => {
        resolveFirst = r
      }),
    )
    getWorkflowRun.mockResolvedValue(mkRun({ id: "run-2", workflow_name: "The second workflow" }))
    const onBack = vi.fn()
    const onOpenThread = vi.fn()
    const { rerender } = render(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    rerender(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-2" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    await screen.findByText("The second workflow")
    await act(async () => {
      resolveFirst(mkRun({ workflow_name: "The FIRST workflow" }))
    })
    expect(screen.queryByText("The FIRST workflow")).toBeNull()
    expect(screen.getByText("The second workflow")).toBeTruthy()
  })

  it("renders the deliverable region as a frame only — Plan 10 fills it", async () => {
    renderPage()
    await screen.findByTestId("canvas-stub")
    const region = screen.getByTestId("run-deliverables")
    expect(region.textContent).toContain("What this run produced")
  })
})

// ── 8. The source fence: what this page must and must not be made of ─────────
//
// Needles are ASSEMBLED FROM PARTS so this file's own source cannot satisfy a grep run
// over it (the 187-24 lesson), and every absence carries a positive control below.

/**
 * The page's source with its comments removed.
 *
 * ⚠ Needed, and for the reason 188-06 and 188-07 both hit before this: a docblock that
 * EXPLAINS an invariant necessarily spells the very token the invariant's grep counts.
 * Anchoring the count on stripped-comment CODE is what lets the explanation stay while
 * the count stays exact — the alternative is deleting the explanation to satisfy a grep,
 * which is the D-ITEM-183-02 trap.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("WorkflowRunPage — source fence", () => {
  it("the comment stripper actually strips (the fences below depend on it)", () => {
    const sample = "/** runReadingLabel( in prose */\n// runReadingLabel( in a line\nconst x = 1\n"
    expect(codeOf(sample)).not.toMatch(/runReadingLabel\(/)
    expect(codeOf(sample)).toMatch(/const x = 1/)
    // ...and the page really does carry the token in prose, which is why this exists.
    expect(pageSource).toMatch(/runReadingLabel\(/)
  })

  it("memoizes the runState lookup with useCallback and passes it BY IDENTITY", () => {
    // An inline arrow at the call site is a new function identity on every render, which
    // invalidates the canvas's settledNodes memo and flickers the cards (188-07 pinned
    // that split; five of its assertions fell to one relocation).
    expect(pageSource).toMatch(/const runState = useCallback\(/)
    expect(pageSource).toMatch(/runState=\{runState\}/)
    expect(pageSource).not.toMatch(/runState=\{\(/)
    // POSITIVE CONTROL — the forbidden shape really is what an inline arrow looks like.
    expect("<WorkflowCanvas runState={(slug) => map.get(slug)} />").toMatch(/runState=\{\(/)
  })

  it("joins on the step index and hands the canvas an already-worded state", () => {
    const code = codeOf(pageSource)
    expect(code).toMatch(/byIndex\.get\(spec\.phase_index\)/)
    // The words are computed HERE, ONCE, so the visible run line and the announced one
    // are the same bytes — and so the G-5-capped canvas file imports no vocabulary.
    expect(code.match(/runReadingLabel\(/g) ?? []).toHaveLength(1)
    expect(code.match(/canvasReading\(/g) ?? []).toHaveLength(1)
    // The join is keyed on the INDEX and on nothing else: no slug-keyed lookup exists.
    expect(code).not.toMatch(/byIndex\.get\(spec\.slug\)/)
  })

  it("does not modify or even name the shared panel reconcile hook", () => {
    const SHARED_HOOK = ["usePanel", "Reconcile"].join("")
    expect(pageSource).not.toMatch(new RegExp(SHARED_HOOK))
    expect(pageSource).toMatch(/reconcile\(\)/)
    // POSITIVE CONTROL.
    expect("import { usePanelReconcile } from '@/hooks/usePanelReconcile'").toMatch(
      new RegExp(SHARED_HOOK),
    )
  })

  it("adds no date library and constructs no HTML", () => {
    const DATE_A = ["date", "-fns"].join("")
    const DATE_B = ["day", "js"].join("")
    const RAW_HTML = ["dangerously", "SetInnerHTML"].join("")
    for (const needle of [DATE_A, DATE_B, RAW_HTML]) {
      expect(pageSource).not.toMatch(new RegExp(needle))
    }
    expect(pageSource).toMatch(/function fmtElapsed/)
    // POSITIVE CONTROL — all three needles match the shapes they forbid.
    expect("import { formatDistance } from 'date-fns'").toMatch(new RegExp(DATE_A))
    expect("import dayjs from 'dayjs'").toMatch(new RegExp(DATE_B))
    expect("<p dangerouslySetInnerHTML={{ __html: x }} />").toMatch(new RegExp(RAW_HTML))
  })

  it("reads no panel-scoped colour token — this surface sits on the page background", () => {
    // Panel tokens are contrast-tuned against the panel surface; reading one off-panel is
    // how a 3.59:1 regression gets reintroduced.
    const DIM = ["muted-foreground", "-dim"].join("")
    const PANEL_SCOPE = ["--", "panel-"].join("")
    expect(pageSource).not.toMatch(new RegExp(DIM))
    expect(pageSource).not.toMatch(new RegExp(PANEL_SCOPE))
    // POSITIVE CONTROL.
    expect("text-muted-foreground-dim").toMatch(new RegExp(DIM))
    expect("text-[hsl(var(--panel-status-done))]").toMatch(new RegExp(PANEL_SCOPE))
  })

  it("renders no second ⌥ toggle — the canvas ships the one that exists", () => {
    const TOGGLE = ["TechnicalNames", "Toggle"].join("")
    expect(pageSource).not.toMatch(new RegExp(TOGGLE))
    // ...but it DOES read the shared provider, which is how the two reveals agree.
    expect(pageSource).toMatch(/useTechnicalNamesOptional\(/)
    // POSITIVE CONTROL.
    expect("<TechnicalNamesToggle />").toMatch(new RegExp(TOGGLE))
  })
})
