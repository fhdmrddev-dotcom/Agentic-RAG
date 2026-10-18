/**
 * Phase 286 Plan 03 (REG-07 / D-09 / D-12) — CHARACTERIZATION PIN for the run page's READ
 * and its BEAT, written against the UNMOVED page before a single line of it moves.
 *
 * What this pins is BEHAVIOUR, never source: the four load screens (DOM snapshots), the 5 s
 * poll's cadence and teardown, the terminal edge's one-shot reconcile, the stale-response
 * guard across a run switch, Try again, and a refresh blip leaving a resolved surface
 * standing. The move that follows (`useWorkflowRun.ts`) must leave this file AND its `.snap`
 * byte-unchanged (`git diff --numstat` empty), which is the whole meaning of "pure move".
 *
 * The harness SHAPE is copied from `WorkflowRunPage.test.tsx` (its module mocks and run
 * fixture), never imported from it — a test file is not a library.
 *
 * ⚠ Every module is mocked under the SAME specifier the page imports, so the pin intercepts
 * what the page actually calls; a hook moved into another file must import from those same
 * specifiers or these mocks stop reaching it and the pin reds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

const getWorkflowRun = vi.fn()
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

const usePhases = vi.fn()
const useWorkspaceFiles = vi.fn()
const useAskUserPrompt = vi.fn()
const reconcile = vi.fn()
const reconcileFiles = vi.fn()
const reconcileAsks = vi.fn()
const reconcileStream = vi.fn((_threadId: string) => Promise.resolve())
const stopThread = vi.fn((_threadId: string): Promise<void> => Promise.resolve())

vi.mock("@/providers/StreamsProvider", () => ({
  usePhases: (...a: unknown[]) => usePhases(...(a as [string | null])),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...(a as [string | null])),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...(a as [string | null])),
  useStreamActions: () => ({ reconcile: reconcileStream, setViewingThread: vi.fn(), stopThread }),
  useStoppingForThread: (_t: string | null) => false,
  useStopNotConfirmedForThread: (_t: string | null) => false,
}))

const useGroundingBundle = vi.fn()
vi.mock("@/hooks/useGroundingBundle", () => ({
  useGroundingBundle: (...a: unknown[]) => useGroundingBundle(...(a as [boolean])),
}))

// React Flow needs a ResizeObserver jsdom does not provide; the canvas is behind a switch
// and not the subject here, so it is a leaf that renders what the page handed it.
vi.mock("@/components/workflows/WorkflowCanvas", () => ({
  WorkflowCanvas: ({ phases }: { phases: PhaseSpecJSON[] }) => (
    <div data-testid="canvas-stub">{phases.length}</div>
  ),
}))

vi.mock("@/components/panel/PendingAskCard", () => ({
  PendingAskCard: ({ ask }: { ask: { tool_call_id: string; prompt: string } }) => (
    <div data-testid={`ask-stub-${ask.tool_call_id}`}>{ask.prompt}</div>
  ),
}))

import { WorkflowRunPage } from "../WorkflowRunPage"
import { ApiError } from "@/lib/api"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SPECS: PhaseSpecJSON[] = [
  { slug: "gather-contracts", phase_index: 0, name: "Find the supplier contracts", config: { phase_type: "llm_agent" } },
  { slug: "draft-letter", phase_index: 1, name: "Draft the renewal letter", config: { phase_type: "llm_agent" } },
  { slug: "final-check", phase_index: 2, name: "Check it over", config: { phase_type: "llm_human_input" } },
]

function mkRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Supplier contract renewals",
    workflow_slug: "supplier-contract-renewals",
    workflow_version: 4,
    status: "active",
    created_at: "2026-08-05T14:03:00Z",
    claimed_at: "2026-08-05T14:03:11Z",
    updated_at: "2026-08-05T14:09:52Z",
    definition: { phases: SPECS },
    phases: [
      { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
      { slug: "draft-letter", phase_index: 1, status: "active", phase_type: "llm_agent" },
      { slug: "final-check", phase_index: 2, status: "pending", phase_type: "llm_human_input" },
    ],
    ...overrides,
  }
}

/** A promise this suite settles by hand — the only way to hold a read in flight. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function page(runId: string | null = "run-1") {
  return (
    <TechnicalNamesProvider>
      <WorkflowRunPage runId={runId} onBack={vi.fn()} onOpenThread={vi.fn()} />
    </TechnicalNamesProvider>
  )
}

/** Let pending promise callbacks run under fake timers without advancing the clock. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Real-timer flush: enough microtask turns for a resolved read to paint. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const COPY_LOADING = "Opening the run…"
const COPY_MISSING_HEAD = "That run isn't available."
const COPY_BROKEN_HEAD = "We couldn't load this run."

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  usePhases.mockReturnValue({ data: [], isLoading: false, error: null, reconcile })
  useWorkspaceFiles.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: reconcileFiles })
  useAskUserPrompt.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: reconcileAsks })
  useGroundingBundle.mockReturnValue({
    kind: "ready",
    degraded: [],
    kbTools: ["search_documents"],
    tools: [],
    folders: [],
    skills: [],
  })
  getWorkflowRun.mockResolvedValue(mkRun())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── 1. The four load screens — DOM pinned byte-for-byte ────────────────────────

describe("286-03 pin — the four load screens", () => {
  it("loading: a read still in flight shows the opening line and nothing else", async () => {
    getWorkflowRun.mockReturnValue(new Promise(() => {}))
    const { container } = render(page())
    await flush()
    expect(screen.getByText(COPY_LOADING)).toBeInTheDocument()
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)
    expect(getWorkflowRun).toHaveBeenCalledWith("run-1")
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("loading: a null id is the calm guard and reads nothing", async () => {
    const { container } = render(page(null))
    await flush()
    expect(screen.getByText(COPY_LOADING)).toBeInTheDocument()
    expect(getWorkflowRun).not.toHaveBeenCalled()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("ready: a non-terminal run resolves to the run surface", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-05T14:05:00Z"))
    const { container } = render(page())
    await settle()
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("missing: a 404 is the not-available screen, with no Try again", async () => {
    getWorkflowRun.mockRejectedValue(new ApiError("not found", 404))
    const { container } = render(page())
    await flush()
    expect(screen.getByText(COPY_MISSING_HEAD)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("broken: any other failure is the could-not-load screen, with Try again", async () => {
    getWorkflowRun.mockRejectedValue(new ApiError("boom", 500))
    const { container } = render(page())
    await flush()
    expect(screen.getByText(COPY_BROKEN_HEAD)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(container.innerHTML).toMatchSnapshot()
  })
})

// ── 2. The beat: cadence, slices on the same beat, teardown on terminal ───────

describe("286-03 pin — the 5 s run poll", () => {
  it("re-reads once per 5000 ms with the three slices on the same beat, and stops on a terminal read", async () => {
    vi.useFakeTimers()
    render(page())
    await settle()
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)
    const r0 = reconcile.mock.calls.length
    const s0 = reconcileStream.mock.calls.length
    const a0 = reconcileAsks.mock.calls.length

    // Nothing before the beat.
    await advance(4999)
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)
    expect(reconcile.mock.calls.length).toBe(r0)
    expect(reconcileStream.mock.calls.length).toBe(s0)
    expect(reconcileAsks.mock.calls.length).toBe(a0)

    // Exactly one read on the beat, and each slice exactly once with it.
    await advance(1)
    expect(getWorkflowRun).toHaveBeenCalledTimes(2)
    expect(getWorkflowRun).toHaveBeenLastCalledWith("run-1")
    expect(reconcile.mock.calls.length).toBe(r0 + 1)
    expect(reconcileStream.mock.calls.length).toBe(s0 + 1)
    expect(reconcileStream).toHaveBeenLastCalledWith("thread-1")
    expect(reconcileAsks.mock.calls.length).toBe(a0 + 1)

    // The next read comes back terminal — the poll tears itself down on it.
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    await advance(5000)
    expect(getWorkflowRun).toHaveBeenCalledTimes(3)
    expect(screen.getByTestId("run-band")).toHaveTextContent("✓ Complete")

    await advance(15000)
    expect(getWorkflowRun).toHaveBeenCalledTimes(3)
  })

  it("a refresh that fails leaves the resolved surface standing", async () => {
    vi.useFakeTimers()
    render(page())
    await settle()
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")

    getWorkflowRun.mockRejectedValue(new ApiError("blip", 500))
    await advance(5000)
    expect(getWorkflowRun).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")
    expect(screen.queryByText(COPY_BROKEN_HEAD)).toBeNull()
  })
})

// ── 3. The terminal edge: one phase reconcile + one file reconcile, once ───────

describe("286-03 pin — the terminal edge", () => {
  it("on the transition to terminal, reconciles the phase slice and the files exactly once", async () => {
    vi.useFakeTimers()
    const { rerender } = render(page())
    await settle()

    // Hold the terminal read in flight so the beat's own reconcile is counted apart from the edge.
    const terminalRead = deferred<ReturnType<typeof mkRun>>()
    getWorkflowRun.mockReturnValue(terminalRead.promise)
    await advance(5000)
    expect(getWorkflowRun).toHaveBeenCalledTimes(2)
    const r1 = reconcile.mock.calls.length
    const f1 = reconcileFiles.mock.calls.length
    expect(f1).toBe(0)

    await act(async () => {
      terminalRead.resolve(mkRun({ status: "completed" }))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByTestId("run-band")).toHaveTextContent("✓ Complete")
    expect(reconcile.mock.calls.length).toBe(r1 + 1)
    expect(reconcileFiles.mock.calls.length).toBe(f1 + 1)

    // Never again on later renders of a finished run.
    rerender(page())
    await advance(15000)
    expect(reconcile.mock.calls.length).toBe(r1 + 1)
    expect(reconcileFiles.mock.calls.length).toBe(f1 + 1)
    expect(getWorkflowRun).toHaveBeenCalledTimes(2)
  })
})

// ── 4. The stale-response guard across a run switch ───────────────────────────

describe("286-03 pin — a response for a run the user left never paints the new one", () => {
  it("run A resolving after run B opened leaves B on screen", async () => {
    const readA = deferred<ReturnType<typeof mkRun>>()
    getWorkflowRun.mockImplementation((id: string) =>
      id === "run-A"
        ? readA.promise
        : Promise.resolve(mkRun({ id: "run-B", thread_id: "thread-B", workflow_name: "Bravo renewals" })),
    )
    const { rerender } = render(page("run-A"))
    await flush()
    expect(screen.getByText(COPY_LOADING)).toBeInTheDocument()

    rerender(page("run-B"))
    await flush()
    expect(screen.getByRole("heading", { level: 1, name: "Bravo renewals" })).toBeInTheDocument()

    await act(async () => {
      readA.resolve(mkRun({ id: "run-A", thread_id: "thread-A", workflow_name: "Alpha renewals" }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByText("Alpha renewals")).toBeNull()
    expect(screen.getByRole("heading", { level: 1, name: "Bravo renewals" })).toBeInTheDocument()
    expect(getWorkflowRun.mock.calls.map((c) => c[0])).toEqual(["run-A", "run-B"])
  })
})

// ── 5. Try again re-reads the same id ─────────────────────────────────────────

describe("286-03 pin — Try again", () => {
  it("from the broken screen, re-reads the same id and reaches the run surface", async () => {
    getWorkflowRun.mockRejectedValueOnce(new ApiError("boom", 500))
    render(page())
    await flush()
    expect(screen.getByText(COPY_BROKEN_HEAD)).toBeInTheDocument()

    getWorkflowRun.mockResolvedValue(mkRun())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await flush()
    expect(getWorkflowRun.mock.calls.map((c) => c[0])).toEqual(["run-1", "run-1"])
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")
  })
})
