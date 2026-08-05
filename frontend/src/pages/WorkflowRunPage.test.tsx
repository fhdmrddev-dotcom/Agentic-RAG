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
import type { Phase, WorkspaceFile } from "@/types"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

// ── The api surface. `ApiError` is declared INSIDE the factory (never imported from
//    the real module) so the page's `err instanceof ApiError` branch is exercised
//    against the very class this suite throws. ──
const getWorkflowRun = vi.fn()
// Plan 10: the shipped bearer-authed raw-bytes helper. Mocked so a download is a
// RECORDED CALL rather than a jsdom navigation — the argument this suite cares about is
// the thread id, and it must be the RUN's.
// ⚠ Typed with its REAL signature, not `unknown[]`: this suite asserts on
// `mock.calls[0][0]` (the thread id), and an untyped spy makes that index a compile
// error under `noUnusedLocals`/strict tuple indexing — the check that matters most here
// would be the one the compiler refuses to let us write.
const downloadWorkspaceFile = vi.fn(
  (_threadId: string, _fileId: string, _filename: string): Promise<void> => Promise.resolve(),
)

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
    downloadWorkspaceFile: (...a: unknown[]) =>
      downloadWorkspaceFile(...(a as [string, string, string])),
  }
})

// ── The live slice + the deliverable list. The page is the ONLY component on this
//    surface that touches the stream, so exactly these two hooks are mocked. ──
const usePhases = vi.fn()
const useWorkspaceFiles = vi.fn()
// A DECOY, and the whole point of it: the globally-viewed thread is what the panel's own
// file list resolves, and it is the wrong answer here. Exporting it from the mock means
// that IF the page ever reached for it, it would resolve — to a deliberately different
// value than the run's thread, so the mistake shows up as a failing assertion rather than
// as a list that quietly belongs to somebody else's thread.
const useViewingThread = vi.fn()
// CR-02: the STORE reconcile — the only thing in the app that opens an SSE subscription
// for a thread the user did not send from. It is a different function from the panel
// reconcile behind `usePhases`, which only refetches the slice.
const reconcileStream = vi.fn(() => Promise.resolve())
const setViewingThread = vi.fn()
// F5: the DURABLE pending-ask slice. Shipped at `StreamsProvider.tsx:3263` long before this
// phase — the run surface simply never consumed it, which is the whole defect.
const useAskUserPrompt = vi.fn()
// F7: the grounding bundle — the ONLY source of the server's kb-tool list (R11: no
// client-assembled whitelist). Mocked at the hook so this suite needs no fetch.
const useGroundingBundle = vi.fn()
vi.mock("@/hooks/useGroundingBundle", () => ({
  useGroundingBundle: (...a: unknown[]) => useGroundingBundle(...(a as [boolean])),
}))
vi.mock("@/providers/StreamsProvider", () => ({
  usePhases: (...a: unknown[]) => usePhases(...(a as [string | null])),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...(a as [string | null])),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...(a as [string | null])),
  useViewingThread: () => useViewingThread(),
  useStreamActions: () => ({ reconcile: reconcileStream, setViewingThread }),
}))

// ── The canvas leaf-stub: it renders what the page HANDED it and nothing else, so a
//    reading in this DOM is a reading the page computed. ──
vi.mock("@/components/workflows/WorkflowCanvas", () => ({
  WorkflowCanvas: ({
    phases,
    runState,
    editable,
    selectedSlug,
    kbTools,
  }: {
    phases: PhaseSpecJSON[]
    runState?: (slug: string) => { reading: string; label: string } | undefined
    editable?: boolean
    selectedSlug: string | null
    kbTools?: readonly string[]
  }) => (
    <div
      data-testid="canvas-stub"
      data-editable={String(editable)}
      data-selected={String(selectedSlug)}
      // F7: the governance input. Rendered as a joined string so a test can assert on the
      // VALUE the page handed down, not merely that some prop was present.
      data-kbtools={(kbTools ?? []).join(",")}
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
const reconcileFiles = vi.fn()
const reconcileAsks = vi.fn()

function setLiveSlice(data: Phase[]) {
  usePhases.mockReturnValue({ data, isLoading: false, error: null, reconcile })
}

/** One row of the shipped `PendingAsk[]` slice. ⚠ Deliberately built with its REAL fields:
 *  `PendingAsk` carries NO phase reference (`types/index.ts:925-937`), which is exactly why
 *  the page cannot join an ask to a step by id and derives the waiting step instead. */
function mkAsk(toolCallId = "call-1") {
  return {
    tool_call_id: toolCallId,
    prompt: "Is this renewal letter ready to send?",
    options: ["Yes, send it", "No, revise it"],
    timeout_seconds: null,
  }
}

/** The pending-ask slice. Defaults to empty — the state every pre-F5 case assumed. */
function setAsks(data: ReturnType<typeof mkAsk>[] = []) {
  useAskUserPrompt.mockReturnValue({
    data,
    isLoading: false,
    error: null,
    reconcile: reconcileAsks,
  })
}

/** The deliverable slice. Defaults to an answered-and-empty list, which is the state
 *  every pre-Plan-10 case in this suite implicitly assumed. */
function setFiles(data: WorkspaceFile[] = [], isLoading = false) {
  useWorkspaceFiles.mockReturnValue({ data, isLoading, error: null, reconcile: reconcileFiles })
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

// ── Plan 10 fixtures: the two thread ids are DELIBERATELY DIFFERENT VALUES ────────
//
// In production both are bare uuids and a swap typechecks, so the only way a wrong-thread
// read is DETECTABLE is if the two fixtures disagree. `RUN_THREAD_ID` is the thread the
// run itself anchors — the correct source for its deliverables. `VIEWED_THREAD_ID` is
// whatever thread chat happens to be looking at, which on this surface is nobody's
// business and is what the panel's own list would have used.
const RUN_THREAD_ID = "thread-of-the-run"
const VIEWED_THREAD_ID = "thread-being-viewed"

/** The flagship deliverable: the artefact the template-fill engine actually emits, and
 *  precisely the kind a reviewer cannot read in place. 18841 B → `18.4 KB`. */
const DELIVERABLE: WorkspaceFile = {
  id: "file-docx-1",
  path: "output/renewal-letter.docx",
  size_bytes: 18841,
  mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  version: 1,
}
const DELIVERABLE_NAME = "renewal-letter.docx"
const DELIVERABLE_SIZE = "18.4 KB"
const DOWNLOAD_LABEL = `Download ${DELIVERABLE_NAME} (${DELIVERABLE_SIZE})`

const COPY_EMPTY_LIVE = "No files yet — this run hasn't written anything."
const COPY_EMPTY_TERMINAL = "This run produced no files."

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  setLiveSlice([])
  setFiles([])
  setAsks([])
  useGroundingBundle.mockReturnValue({
    kind: "ready",
    degraded: [],
    kbTools: ["analyze_document", "get_related_documents", "query_documents", "read_document", "search_documents"],
    tools: [],
    folders: [],
    skills: [],
  })
  useViewingThread.mockReturnValue(VIEWED_THREAD_ID)
  downloadWorkspaceFile.mockResolvedValue(undefined)
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

  // ⚠ AMENDED by F3 (UAT 2026-08-05). This case originally asserted that a null `claimed_at`
  //   renders "Waiting to start" and no number. That was written when `claimed_at` was believed
  //   to be the anchor; the live DB says it is populated on 5 of 181 runs and 0 of 149 completed
  //   ones, so the branch this pinned fired on essentially every run and produced
  //   "✓ Complete   Waiting to start". The RULE it was protecting is intact and re-asserted
  //   below — a number is never shown without the field it came from — but the anchor now falls
  //   back to `created_at` (NOT NULL) instead of the slot going silent.
  it("claimed_at == null falls back to created_at and LABELS it — never a bare number", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("queued")
    expect(slot).not.toContain("Waiting to start")
    // A number IS shown now, inseparable from its label. The invariant this case protects is
    // "never a figure without its anchor", not "never a figure" — the original no-digit rule
    // was the right rule applied to an anchor that turned out never to be populated.
    expect(slot).toMatch(/\d+\s*[smh]\b/)
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

  // ⚠ AMENDED by F3 (UAT 2026-08-05). This asserted that a never-claimed `active` run reads
  //   "Waiting to start". Observed live: the band said exactly that while the first step was
  //   visibly Running on the canvas beside it. `claimed_at` is null for queued AND running runs
  //   alike here, so it cannot separate them; the row's own `active` status can.
  it("an `active` run that was never claimed still reads Running — claimed_at cannot mean queued", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain("Running")
    expect(band).not.toContain("Waiting to start")
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

  // Plan 08 authored this as "a frame only — Plan 10 fills it". Plan 10 filled it; the
  // assertion it makes is the region's IDENTITY, which is unchanged and still worth
  // holding, so the case is renamed rather than deleted.
  it("renders the deliverable region under its own heading", async () => {
    renderPage()
    await screen.findByTestId("canvas-stub")
    const region = screen.getByTestId("run-deliverables")
    expect(region.textContent).toContain("What this run produced")
  })
})

// ── 7b. The deliverable: listed and downloadable, never previewed (SPEC Req 7) ────
//
// This is the `🕐 Tomorrow` half of the phase: a day later, can the user find the run and
// GET THE FILE IT MADE? Everything below measures that answer, and measures that the
// answer is sourced from the run's OWN thread.

describe("WorkflowRunPage — the deliverable is listed and downloadable", () => {
  beforeEach(() => {
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
    setFiles([DELIVERABLE])
  })

  it("lists the file the run produced, with its name and its size", async () => {
    renderPage()
    const row = await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    expect(row.textContent).toContain(DELIVERABLE_NAME)
    expect(row.textContent).toContain(DELIVERABLE_SIZE)
    // The full path is available without being the visible label.
    expect(row.getAttribute("title")).toBe(DELIVERABLE.path)
  })

  it("reads the list from the RUN's thread and never from the viewed thread", async () => {
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const args = useWorkspaceFiles.mock.calls.map((c) => c[0])
    expect(args).toContain(RUN_THREAD_ID)
    expect(args).not.toContain(VIEWED_THREAD_ID)
  })

  it("downloads with the RUN's thread id, the file id and the bare filename", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: DOWNLOAD_LABEL }))
    expect(downloadWorkspaceFile).toHaveBeenCalledWith(
      RUN_THREAD_ID,
      DELIVERABLE.id,
      DELIVERABLE_NAME,
    )
    // Stated separately and on purpose: the two fixtures differ so THIS is a measurement.
    expect(downloadWorkspaceFile.mock.calls[0][0]).not.toBe(VIEWED_THREAD_ID)
  })

  it("offers NO preview for the .docx row — no pane, no frame, only the download", async () => {
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const region = screen.getByTestId("run-deliverables")
    expect(region.querySelector("iframe")).toBeNull()
    expect(region.querySelector("embed")).toBeNull()
    expect(region.querySelector("object")).toBeNull()
    expect(region.querySelector("[data-testid*='preview']")).toBeNull()
    // Exactly one control in the region, and it is the download.
    const buttons = region.querySelectorAll("button")
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute("aria-label")).toBe(DOWNLOAD_LABEL)
    // POSITIVE CONTROL — the probes really do find the shapes they forbid.
    const probe = document.createElement("div")
    probe.innerHTML = `<iframe></iframe><div data-testid="file-preview"></div>`
    expect(probe.querySelector("iframe")).not.toBeNull()
    expect(probe.querySelector("[data-testid*='preview']")).not.toBeNull()
  })

  it("renders the rows as a list, one row per file", async () => {
    setFiles([
      DELIVERABLE,
      { id: "file-2", path: "notes.md", size_bytes: 512, mime_type: "text/markdown" },
    ])
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const region = screen.getByTestId("run-deliverables")
    const list = region.querySelector('[role="list"]')
    expect(list).not.toBeNull()
    expect(list?.querySelectorAll("li")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Download notes.md (512 B)" })).toBeTruthy()
  })

  it("surfaces a failed download where the user clicked, instead of swallowing it", async () => {
    downloadWorkspaceFile.mockRejectedValueOnce(new Error("File not found."))
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: DOWNLOAD_LABEL }))
    expect((await screen.findByTestId("run-download-error")).textContent).toContain(
      "File not found.",
    )
  })

  it("a row the listing gave with no id is shown as a fact, never as a dead control", async () => {
    setFiles([{ path: "orphan.docx", size_bytes: 100, mime_type: "" }])
    renderPage()
    await screen.findByTestId("canvas-stub")
    const region = screen.getByTestId("run-deliverables")
    expect(region.textContent).toContain("orphan.docx")
    // No control — the raw route would be built with an empty id segment and 404.
    expect(region.querySelectorAll("button")).toHaveLength(0)
  })
})

describe("WorkflowRunPage — the two empty states say different true things", () => {
  it("a LIVE run with no files says nothing has been written YET", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", thread_id: RUN_THREAD_ID }))
    setFiles([])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-deliverables").textContent).toContain(COPY_EMPTY_LIVE)
    expect(screen.queryByText(COPY_EMPTY_TERMINAL)).toBeNull()
  })

  it("a TERMINAL run with no files says it produced none — the tense is the fact", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([])
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(screen.getByTestId("run-deliverables").textContent).toContain(COPY_EMPTY_TERMINAL)
    expect(screen.queryByText(COPY_EMPTY_LIVE)).toBeNull()
  })

  it("claims NEITHER while the first read is still in flight", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([], true)
    renderPage()
    await screen.findByTestId("canvas-stub")
    const region = screen.getByTestId("run-deliverables")
    expect(region.textContent).not.toContain(COPY_EMPTY_TERMINAL)
    expect(region.textContent).not.toContain(COPY_EMPTY_LIVE)
    // The heading is still there — the region exists, it just makes no claim yet.
    expect(region.textContent).toContain("What this run produced")
  })
})

describe("WorkflowRunPage — the seam, run side (D-188-13)", () => {
  it("hands the thread seam the RUN's thread id, not the viewed one", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
    const { onOpenThread } = renderPage()
    await screen.findByTestId("canvas-stub")
    fireEvent.click(screen.getByText("Open the chat thread"))
    expect(onOpenThread).toHaveBeenCalledWith(RUN_THREAD_ID)
    expect(onOpenThread).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
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
})

// ── CR-02 (Phase 188 review) — SOMETHING HAS TO OPEN THE RUN'S STREAM ─────────────────
//
// Before this phase, `doRun` ended `selectThread(thread); onNavigate("chat")`. The stream
// was armed by the SECOND call, not the first: `selectThread` only moves `useThreads`'
// selection, and the store's `setViewingThread` — whose body fires `actions.reconcile`,
// the ONLY caller of `subscribeToRun` for a thread the user did not send from — is
// invoked from exactly ONE production site, `ChatArea`'s layout effect. `ChatArea` mounts
// ONLY inside the `activeView === "chat"` branch, and `ChatLayout.launch.test.tsx`'s own
// source fence asserts that.
//
// ⚠ SO THE REVIEW'S "MINIMAL" FIX — putting `selectThread(thread)` back in `doRun` beside
// `onNavigate("workflow-run")` — WOULD NOT WORK. With the chat branch unmounted there is
// nothing left to turn a selection into a subscription. Measured, not assumed: the only
// production callers of `setViewingThread` are `ChatArea.tsx:224` and `:323`.
//
// The fix therefore lands where the review's own stated alternative put it — on the page,
// once the run read resolves. That is also strictly better than the ChatLayout version,
// because it is PATH-INDEPENDENT: the panel-receipt door (`openRunSurface`) and a
// re-opened finished run get the same treatment as a fresh launch, rather than the launch
// path being special-cased.
//
// It calls the store reconcile DIRECTLY rather than `setViewingThread`, and that is
// deliberate: `setViewingThread` also writes `viewedThreadId`, i.e. chat state, and this
// surface's standing rule is that opening a run writes no chat state (the same rule the
// file-list fence above enforces from the reading side). The consequence — that the
// provider's own visibility listeners key on `activeThreadIdRef` and so still do not
// cover this thread — is already answered by the page's OWN wake listeners, which is why
// the wake case is asserted below rather than left implied.

describe("WorkflowRunPage — the run's stream is opened (CR-02)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
  })

  it("reconciles the RUN's thread once the run read resolves — the subscription seam", async () => {
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledWith(RUN_THREAD_ID))
  })

  it("never reconciles the VIEWED thread — opening a run is not a chat navigation", async () => {
    useViewingThread.mockReturnValue(VIEWED_THREAD_ID)
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledWith(RUN_THREAD_ID))
    expect(reconcileStream).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
    // And chat's own pointer is never written — the same property the file-list fence
    // protects from the reading side.
    expect(setViewingThread).not.toHaveBeenCalled()
  })

  it("re-opens the stream on wake, beside the slice and the file list", async () => {
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledTimes(1))

    reconcileStream.mockClear()
    reconcile.mockClear()
    reconcileFiles.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })

    // A lid closed across a reconnect drops the SSE connection; re-reading the slice
    // without re-attaching leaves the surface frozen from that moment on.
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledWith(RUN_THREAD_ID))
    expect(reconcile).toHaveBeenCalled()
    expect(reconcileFiles).toHaveBeenCalled()
  })

  it("does nothing at all before a run has resolved", async () => {
    renderPage({ runId: null })
    await screen.findByText("Opening the run…")
    expect(reconcileStream).not.toHaveBeenCalled()
  })
})

// ── CR-01 (Phase 188 review) — THE RUN ROW IS RE-READ, not frozen at mount ────────────
//
// `setRun` had exactly one caller: the effect keyed on `[runId, retryNonce]`, and
// `retryNonce` is bumped only by a button that renders on the broken screen. There was no
// poll, no interval, and the reconnect effect re-read the phase slice and the file list but
// never the RUN. Everything derived from `run.status` was therefore frozen for the whole
// session — and a run-level status is the one fact no other source on this surface carries:
//
//   · the band renders "● Running" until the user leaves the page, long after the run
//     completed or failed;
//   · `isTerminal` never flips, so `aria-busy` stays true and the elapsed slot never
//     switches to its frozen "Ran for …" form;
//   · the once-a-second clock KEEPS COUNTING after the run stopped — worse than a stale
//     word, because a ticking number is an active claim of liveness;
//   · a run that FAILS while being watched never fires the assertive alert, because
//     `run.status` is still the launch-time value.
//
// That is the headline requirement inverted: the surface asserts a run is running at
// exactly the moment it is not.

describe("WorkflowRunPage — the run row is re-read while it is live (CR-01)", () => {
  /** Let the mount read resolve under fake timers before advancing anything. */
  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it("polls while non-terminal, so a run that finishes stops claiming it is running", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")

    // The run finishes on the server. Nothing on this surface would ever learn that.
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByTestId("run-band")).toHaveTextContent("✓ Complete")
    // …and the clock is frozen rather than still counting.
    expect(screen.getByTestId("run-elapsed")).toHaveTextContent("Ran for")
  })

  // ── F1 (UAT 2026-08-05) — THE CANVAS FROZE WHILE A PERSON WATCHED IT. ──
  //
  // Driven live: a 3-phase run whose DB rows read `completed / active / pending` painted
  // `Running / Not started / Not started` for 100 s on a VISIBLE tab and never moved. The
  // reconcile machinery was fine — a wake event snapped it straight to the truth. Nothing
  // was DRIVING it. The run row polled every 5 s (CR-01); the phase slice polled never, and
  // the stream was re-attempted only on mount, where `latest_producer_run_id` is still null
  // on an `llm_human_input` phase (the producer run ends while the workflow run continues).
  //
  // "Watch a run" is the phase goal, and the watching case is exactly the one with no wake
  // event in it. So the slice rides the SAME beat as the run.
  // ── F3 (UAT 2026-08-05) — `claimed_at` IS NEVER POPULATED, so anchoring on it alone
  //    made the surface contradict itself. Measured against the live DB:
  //
  //        workflow_runs: 181 total ·   5 with claimed_at
  //          completed:   149 rows  ·   0 with claimed_at
  //
  //    Zero of 149 finished runs carry the field. So a completed run rendered
  //    "✓ Complete   Waiting to start", and an ACTIVE run's band read "Waiting to start"
  //    while its first step was visibly Running. `created_at` is NOT NULL and is the
  //    honest fallback — a queued-anchored figure, labelled as one.
  it("a finished run with no claimed_at still shows a number, anchored on created_at and SAID so", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: null }))
    renderPage()
    await settle()
    const el = screen.getByTestId("run-elapsed")
    expect(el).not.toHaveTextContent("Waiting to start")
    expect(el).toHaveTextContent("Ran for")
    expect(el).toHaveTextContent("queued")
  })

  it("an active run whose claimed_at is null still reads Running — the field cannot mean queued when nothing sets it", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await settle()
    expect(screen.getByTestId("run-band")).toHaveTextContent("Running")
    expect(screen.getByTestId("run-band")).not.toHaveTextContent("Waiting to start")
  })

  it("a queued-anchored figure names its anchor in the plain layer too", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: null }))
    renderPage()
    await settle()
    // The ⌥ layer additionally prints the literal field (`created_at`), but the plain wording
    // must already say WHICH clock it is — the reveal is an elaboration, never the only place
    // the anchor is disclosed.
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("queued")
    expect(slot).toContain("Ran for")
  })

  it("polls the PHASE SLICE on the same beat, so a watched canvas advances without a wake", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    const afterMount = reconcile.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(reconcile.mock.calls.length).toBeGreaterThan(afterMount)
  })

  it("re-attempts the STREAM on the poll — a subscription that could not arm at mount gets another chance", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    const afterMount = reconcileStream.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    // At mount the thread's `latest_producer_run_id` can legitimately be null; one attempt
    // is not enough, and a canvas frozen for the rest of the run is the cost of assuming it.
    expect(reconcileStream.mock.calls.length).toBeGreaterThan(afterMount)
  })

  it("takes a FINAL slice + file read at the terminal edge — the poll tears down on that same tick", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()

    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    const beforeTerminal = { slice: reconcile.mock.calls.length, files: reconcileFiles.mock.calls.length }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    await settle()
    // The deliverable row appears AS the run finishes, and the poll stops on the read that
    // observes it — without an edge read the last state and the file never land.
    expect(reconcile.mock.calls.length).toBeGreaterThan(beforeTerminal.slice)
    expect(reconcileFiles.mock.calls.length).toBeGreaterThan(beforeTerminal.files)
  })

  it("stops polling once the run is terminal — a finished run is not re-read forever", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    renderPage()
    await settle()
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)
  })

  it("a failing poll leaves a good surface standing — a blip is not a broken run", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()

    getWorkflowRun.mockRejectedValue(new ApiError("gateway", 502))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    // Still the run, NOT the broken screen: the mount read's error branch owns the
    // load-phase, and a poll must never be able to tear down a surface that resolved.
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")
    expect(screen.queryByText("We couldn't load this run.")).not.toBeInTheDocument()
  })

  it("a run that FAILS while being watched fires the assertive alert", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    expect(screen.getByTestId("run-alert")).toHaveTextContent("")

    getWorkflowRun.mockResolvedValue(mkRun({ status: "failed" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    // The alert exists to be un-missable; it could never fire while the status was frozen
    // at its launch-time value.
    expect(screen.getByTestId("run-alert")).toHaveTextContent("Failed")
  })

  it("re-reads the RUN on wake, beside the slice and the file list", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(getWorkflowRun).toHaveBeenCalledTimes(1))

    // A lid closed across the run's completion: the verdict must be re-read on wake, not
    // waited out. (Real timers here on purpose — this path is event-driven, not polled.)
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })
    await waitFor(() =>
      expect(screen.getByTestId("run-band")).toHaveTextContent("✓ Complete"),
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

  // ── Plan 10 additions ──────────────────────────────────────────────────────

  it("sources the deliverable list from the RUN's thread, at exactly one call site", () => {
    const code = codeOf(pageSource)
    expect(code.match(/useWorkspaceFiles\(/g) ?? []).toHaveLength(1)
    expect(code).toMatch(/useWorkspaceFiles\(run\?\.thread_id/)
    expect(code.match(/downloadWorkspaceFile\(/g) ?? []).toHaveLength(1)
    expect(code).toMatch(/const runThreadId = run\?\.thread_id/)
    expect(code).toMatch(/downloadWorkspaceFile\(runThreadId/)
  })

  it("neither mounts the panel's file list nor names it — it reads the viewed thread", () => {
    // The panel list resolves its thread from the globally-viewed-thread selector rather
    // than from a prop, so mounting it here would WRITE chat state as a side effect of
    // opening a run. Only its icon mapping and byte formatter are mirrored, and both are
    // pure. The selector itself must not appear either — that is the mechanism.
    const PANEL_LIST = ["Files", "Section"].join("")
    const VIEWED = ["useViewing", "Thread"].join("")
    expect(pageSource).not.toMatch(new RegExp(PANEL_LIST))
    expect(pageSource).not.toMatch(new RegExp(VIEWED))
    // ...and the mirrored pieces really are here.
    expect(codeOf(pageSource)).toMatch(/function formatBytes/)
    expect(codeOf(pageSource)).toMatch(/function iconFor/)
    // POSITIVE CONTROLS — both assembled needles match the shapes they forbid.
    expect("import { FilesSection } from './FilesSection'").toMatch(new RegExp(PANEL_LIST))
    expect("const threadId = useViewingThread()").toMatch(new RegExp(VIEWED))
  })

  it("promises no preview: the previewer is neither imported nor named", () => {
    // DOCX/PPTX/XLSX/PDF are download-only by decision and the template engine emits
    // .docx, so the flagship deliverable is exactly the artefact that cannot be shown in
    // place. Req 7 asks that it be listed and downloadable — not that it be rendered.
    const PREVIEWER = ["File", "Preview"].join("")
    expect(pageSource).not.toMatch(new RegExp(PREVIEWER))
    // POSITIVE CONTROL.
    expect("<FilePreview threadId={t} file={f} onBack={b} />").toMatch(new RegExp(PREVIEWER))
  })

  it("carries both empty-state strings, each written exactly once", () => {
    const code = codeOf(pageSource)
    expect(code.match(/No files yet — this run hasn't written anything\./g) ?? []).toHaveLength(1)
    expect(code.match(/This run produced no files\./g) ?? []).toHaveLength(1)
  })
})

// ── F5 (UAT 2026-08-05) — THE RUN-TIME WAITING READING WAS STRUCTURALLY UNREACHABLE ──
//
// Observed live on `doc_qa_scoped_098uat`: phase 1 `confirm`, an `llm_human_input` step, DB
// status `active`, a real pending ask sitting on the thread — and the canvas read
// "Running". Never "Paused for your answer".
//
// The mechanism, measured: `canvasReading` has always had its `pendingAsk != null` arm
// (`phaseState.ts:124`) and it is FIRST, ahead of every status. But `reconcilePhases`
// hardcodes `pendingAsk: null` in BOTH of its branches (`StreamsProvider.tsx:3427` live,
// `:3466` terminal), so the field is populated only by a live SSE event — and after F1 this
// surface rides POLLED reconciles, each of which resets it to null. The reading Req 5
// specifies was real in `runVocabulary`, real in the unit suite, and not reachable in the
// product on this surface.
//
// The fix consumes the DURABLE ask slice that already shipped and derives the waiting step,
// because `PendingAsk` carries no phase reference. The derivation is sound only because the
// harness runs a LINEAR spine one phase at a time and only an `llm_human_input` phase blocks
// on an ask — so the negative controls below are not ceremony: each one is a way the
// derivation could over-claim, and over-claiming is the exact defect this phase exists to
// remove.

describe("WorkflowRunPage — the run-time waiting reading (F5, SPEC Req 5)", () => {
  it("an ACTIVE llm_human_input step with a pending ask reads Paused for your answer, not Running", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "done", "draft-letter"),
      mkPhase(2, "running", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("canvas-stub")

    expect(readings()["final-check"]).toBe("waiting-for-you")
    expect(labels()["final-check"]).toContain("Paused for your answer")
    expect(labels()["final-check"]).not.toContain("Running")
  })

  // NEGATIVE CONTROL 1 — the ask must not spill onto the step that merely happens to be
  // running. A `llm_agent` step cannot block on an ask, so an ask on the thread says
  // nothing about it.
  it("a pending ask does NOT make a running llm_agent step read as waiting", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("canvas-stub")

    expect(readings()["draft-letter"]).toBe("running")
  })

  // NEGATIVE CONTROL 2 — D-188-05, the separation this phase locked. The design-time
  // property ("this step WILL pause") is true before anything runs; the run-time state
  // ("it IS paused, now") requires an actual ask. A step that carries the badge and is
  // running with nothing pending is RUNNING.
  it("an active llm_human_input step with NO pending ask still reads Running", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "done", "draft-letter"),
      mkPhase(2, "running", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([])
    renderPage()
    await screen.findByTestId("canvas-stub")

    expect(readings()["final-check"]).toBe("running")
  })

  // NEGATIVE CONTROL 3 — a step the run has not REACHED is not waiting on anyone, whatever
  // is pending on the thread. Without the status arm the whole spine would read as paused.
  it("a not-yet-reached llm_human_input step reads Not started even with an ask pending", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("canvas-stub")

    expect(readings()["final-check"]).toBe("not-started")
  })

  // NEGATIVE CONTROL 4 — the run itself has to still be live. A cancelled run can leave a
  // phase row at `active` with an unanswered ask on its thread; the band correctly reads
  // "⊘ Cancelled", and a node beside it saying "it needs your reply before it can continue"
  // would be the phase's own defect in a new place — the run needs nothing from anyone.
  it("a terminal run does not claim a step is waiting, even with an ask still pending", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({
        status: "cancelled",
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: null },
          { slug: "draft-letter", phase_index: 1, status: "completed", phase_type: null },
          { slug: "final-check", phase_index: 2, status: "active", phase_type: null },
        ],
      }),
    )
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("canvas-stub")

    expect(readings()["final-check"]).toBe("running")
    expect(labels()["final-check"]).not.toContain("Paused for your answer")
  })

  it("reads the ask slice for the RUN's thread, never the globally-viewed one", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
    renderPage()
    await screen.findByTestId("canvas-stub")

    expect(useAskUserPrompt).toHaveBeenCalledWith(RUN_THREAD_ID)
    expect(useAskUserPrompt).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
  })

  // The staleness half. An ask slice fetched once at mount inherits EXACTLY the defect F1
  // just fixed: someone sitting and watching produces no wake event, so a step that starts
  // waiting after mount would never be seen to.
  it("re-reads the ask slice on the 5s poll", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const afterMount = reconcileAsks.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(reconcileAsks.mock.calls.length).toBeGreaterThan(afterMount)
  })

  it("re-reads the ask slice on wake", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("canvas-stub")
    const afterMount = reconcileAsks.mock.calls.length

    await act(async () => {
      fireEvent(window, new Event("visibilitychange"))
    })
    await waitFor(() =>
      expect(reconcileAsks.mock.calls.length).toBeGreaterThan(afterMount),
    )
  })
})

// ── F6 (UAT 2026-08-05) — THE LIVE CLOCK NEVER TICKED. F3's own residue. ──
//
// F3 moved the elapsed figure's ANCHOR from `claimed_at` to a `created_at` fallback, because
// `claimed_at` is null on essentially every run (5 of 181 rows; 0 of 149 completed). It did
// not move the TICK GATE, which still read `claimedMs != null`. So on every live run the
// interval never armed, `nowMs` stayed frozen at its mount value, and the band rendered a
// number that looked live and was not.
//
// Observed live on run `99f10a40`: created 15:38:45.8, screen read at 15:40:31 — about 106 s
// elapsed — and the band said "3s since it was queued", the value as of mount. The same
// class of defect F3 existed to remove: a figure claiming a measurement nobody is taking.
//
// Root cause is that "is there an anchor?" was computed in TWO places and F3 updated one.
// The fix computes it once.

describe("WorkflowRunPage — the live elapsed figure actually advances (F6)", () => {
  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it("ticks on a live run whose claimed_at is null — the case that is EVERY run", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-05T14:03:05Z"))
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await settle()
    const first = screen.getByTestId("run-elapsed").textContent ?? ""

    // 3s — deliberately UNDER the 5s poll, so anything that changes here changed because
    // the clock ticked, not because the run row was re-read.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    const second = screen.getByTestId("run-elapsed").textContent ?? ""

    expect(first).toContain("5s")
    expect(second).toContain("8s")
    expect(second).not.toBe(first)
  })

  // The guard against over-fixing: a run that has STOPPED must stay frozen. Its figure is
  // measured between two recorded timestamps and has nothing to do with the wall clock.
  it("does NOT tick on a terminal run — a finished figure is a measurement, not a clock", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-05T14:03:05Z"))
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: null }))
    renderPage()
    await settle()
    const first = screen.getByTestId("run-elapsed").textContent ?? ""

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(screen.getByTestId("run-elapsed").textContent ?? "").toBe(first)
  })
})

// ── F7 (UAT 2026-08-05) — THE GOVERNANCE SEAL NEVER RENDERED ON THE RUN SURFACE ──
//
// SC#1 requires each node to show "live state ... AND its grounded-cited vs open
// governance state". The run surface showed the first and never the second.
//
// Mechanism, measured: `toCanvas` resolves `grounded` via `isGrounded(phase, kbTools)`,
// and `canvasModel.ts:360` defaults an omitted `kbTools` to the frozen empty
// `NO_KB_TOOLS`. `WorkflowRunPage` rendered `<WorkflowCanvas>` with NO `kbTools` prop, so
// the intersection `available_tools ∩ kb_tools` was against the empty set and the
// **`detected`** cause — the dominant one, and the only one most fixtures have — could
// never resolve. `already-set` and `escalated` still would, which is why the miss is
// quiet: governance appears to work on the workflows that declare it explicitly.
//
// Falsified live on `doc_qa_scoped_098uat`, the SAME workflow on both surfaces:
//   Builder canvas   node "Work out how to do it" → data-grounded="true"
//   Run surface      the same node                → no attribute at all
//
// `useGroundingBundle`'s own docblock names this exact consumer: the kb-tool list is used
// "for one thing: the local available_tools ∩ kb_tools intersection that moves the dial,
// the strike-through and THE CANVAS SEAL". The run surface simply never asked for it.

describe("WorkflowRunPage — the governance seal's input reaches the canvas (F7, SC#1)", () => {
  it("hands the canvas the server's kb-tool list, so a detected-grounded step can be marked", async () => {
    renderPage()
    const stub = await screen.findByTestId("canvas-stub")
    // The VALUE, not merely the presence of a prop: an empty list is exactly the broken
    // state, because `available_tools ∩ [] = ∅` for every step ever authored.
    expect(stub.getAttribute("data-kbtools")).toContain("search_documents")
  })

  it("asks for the bundle — the page is a READER of the server list, never an author of one", async () => {
    renderPage()
    await screen.findByTestId("canvas-stub")
    expect(useGroundingBundle).toHaveBeenCalled()
    // R11: a client-assembled whitelist would let knowledge-base content whitelist itself.
    // The literal must not appear in the page's own source.
    const KB = ["search", "_documents"].join("")
    expect(codeOf(pageSource)).not.toMatch(new RegExp(KB))
    // POSITIVE CONTROL — that needle really does match a hardcoded list.
    expect('const KB_TOOLS = ["search_documents"]').toMatch(new RegExp(KB))
  })
})
