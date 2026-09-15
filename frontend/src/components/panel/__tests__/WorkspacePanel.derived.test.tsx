/**
 * Phase 095.1 Plan 06 (GAP-1 / WORKSPACE-PARITY) — guard test for the
 * hasActivity → TodosSection → derived-render path.
 *
 * The sibling `WorkspacePanel.test.tsx` file-level-mocks `TodosSection` to a thin
 * sentinel, so it can NEVER exercise the gate → derived-render path: a thread with
 * only tool-call activity (no real write_todos / files / asks / phases) short-
 * circuits to <PanelEmpty/> at the hasActivity gate, and the mocked TodosSection
 * never mounts. This file is the missing guard: it renders the REAL WorkspacePanel
 * + the REAL TodosSection (which calls the real useDerivedPanel), and mocks ONLY
 * useDerivedPanel (to feed derived items) + the four panel data hooks + the heavy
 * non-todos children. It must live in a SEPARATE vi.mock scope from
 * WorkspacePanel.test.tsx (which globally mocks TodosSection) — do NOT merge it in.
 *
 * Test A is the headline RED: before the Task-2 fix, hasActivity omits the derived
 * signal → PanelEmpty short-circuits → the derived rows never render.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type {
  Todo,
  WorkspaceFile,
  PendingAsk,
  Phase,
  TaskRunIndexItem,
} from "@/types"
import type { DerivedPanelItem } from "@/lib/workspacePanel"
import { mockTodos, mockWorkspaceFiles } from "./fixtures"

const useTodos = vi.fn()
const useWorkspaceFiles = vi.fn()
const useAskUserPrompt = vi.fn()
const useViewingThread = vi.fn()
const usePhases = vi.fn()
const useTasks = vi.fn()
const useWorkflowLockForThread = vi.fn()
// CRITICAL: useDerivedPanel lives in StreamsProvider too — the REAL TodosSection
// imports it. Add it to the SAME mock object so the real TodosSection's call is
// intercepted (the existing WorkspacePanel.test.tsx mocks TodosSection itself, so
// it never needed this entry).
const useDerivedPanel = vi.fn()
// Phase 194 Plan 03 Task 1 (RUN-01 / SC#1) — the NINTH key, owed here for the SAME
// structural reason as in WorkspacePanel.test.tsx: this mock is an explicit object
// literal, and this file renders the REAL WorkspacePanel, which now reads
// useStreamActions to mount its run-level Stop. A missing key throws the whole file.
// The stub is inert on purpose — the Stop's behaviour is measured next door (V-04);
// what this file measures is the derived-panel gate, which the Stop must not disturb.
// (the rest parameter is load-bearing: the mock below SPREADS its args into this fn,
// and a zero-arity stub is a TS2556 spread-argument error, not merely untidy.)
const useStreamActions = vi.fn((..._a: unknown[]) => ({ stopThread: vi.fn() }))
// ⛔ Phase 250 (HONEST-03) — `useStreamingForThread` / `useLoadingForThread` are declared here
// because THIS SUITE renders the REAL `TodosSection`, and that component now asks whether a run is
// live on the thread it is showing. A mock factory that omits a newly-added export makes every
// test in the file throw AT MOUNT — the Phase 196 `@/lib/api` lesson, 249 failures in one run.
// ⚠ AND THIS SUITE IS IN NEITHER COUNT-GATE KNOB, so the gate read 0 failing while these three
// were red. It was caught by running the panel directory by hand, not by a gate.
// Default is a LIVE run, matching how the rest of this file reads: derived rows mirror tool
// activity, which only exists while something is running.
const useStreamingForThread = vi.fn(() => true)
const useLoadingForThread = vi.fn(() => false)
vi.mock("@/providers/StreamsProvider", () => ({
  useStreamingForThread: (...a: unknown[]) => useStreamingForThread(...a),
  useLoadingForThread: (...a: unknown[]) => useLoadingForThread(...a),
  useTodos: (...a: unknown[]) => useTodos(...a),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
  usePhases: (...a: unknown[]) => usePhases(...a),
  useTasks: (...a: unknown[]) => useTasks(...a),
  useWorkflowLockForThread: (...a: unknown[]) => useWorkflowLockForThread(...a),
  useDerivedPanel: (...a: unknown[]) => useDerivedPanel(...a),
  useStreamActions: (...a: unknown[]) => useStreamActions(...a),
}))

// Mock the heavy NON-todos children to thin sentinels exactly as
// WorkspacePanel.test.tsx does, so ONLY the Todos path is real. Do NOT mock
// TodosSection — that is the whole point (render the gate → derived path).
vi.mock("@/components/panel/PhaseTimeline", () => ({
  PhaseTimeline: () => <div data-testid="phase-timeline">timeline</div>,
}))
vi.mock("@/components/panel/BatchResultList", () => ({
  BatchResultList: () => <div data-testid="batch-result-list">sub-results</div>,
}))
vi.mock("@/components/panel/FilesSection", () => ({
  FilesSection: () => <div data-testid="files-section">files</div>,
}))
// Phase 100 (D-01): the empty short-circuit renders the REAL TemplateUpload
// (reads useStreamActions, absent from this file's StreamsProvider mock).
vi.mock("@/components/panel/TemplateUpload", () => ({
  TemplateUpload: () => <div data-testid="template-upload">upload</div>,
}))
vi.mock("@/components/panel/VersionDiff", () => ({
  VersionDiff: () => <div data-testid="version-diff">diff</div>,
}))
vi.mock("@/components/panel/PendingAskCard", () => ({
  PendingAskStack: () => <div data-testid="pending-ask-stack">asks</div>,
}))

// eslint-disable-next-line import/first
import { WorkspacePanel, type PanelState } from "@/components/panel/WorkspacePanel"

const thread = { id: "thread-1", title: "T" } as never

function setHooks({
  todos = [] as Todo[],
  files = [] as WorkspaceFile[],
  asks = [] as PendingAsk[],
  viewing = "thread-1" as string | null,
  phases = [] as Phase[],
  tasks = [] as TaskRunIndexItem[],
  lock = null as { runId: string; mode: "harness"; capPaused: boolean; continuesRemaining: number } | null,
  derived = [] as DerivedPanelItem[],
}: {
  todos?: Todo[]
  files?: WorkspaceFile[]
  asks?: PendingAsk[]
  viewing?: string | null
  phases?: Phase[]
  tasks?: TaskRunIndexItem[]
  lock?: { runId: string; mode: "harness"; capPaused: boolean; continuesRemaining: number } | null
  derived?: DerivedPanelItem[]
}) {
  useTodos.mockReturnValue({ data: todos, isLoading: false, error: null, reconcile: vi.fn() })
  useWorkspaceFiles.mockReturnValue({ data: files, isLoading: false, error: null, reconcile: vi.fn() })
  useAskUserPrompt.mockReturnValue({ data: asks, isLoading: false, error: null, reconcile: vi.fn() })
  useViewingThread.mockReturnValue(viewing)
  usePhases.mockReturnValue({ data: phases, isLoading: false, error: null, reconcile: vi.fn() })
  useTasks.mockReturnValue({ data: tasks, isLoading: false, error: null, reconcile: vi.fn() })
  useWorkflowLockForThread.mockReturnValue(lock)
  useDerivedPanel.mockReturnValue(derived)
}

interface RenderOpts {
  state?: PanelState
}
function renderPanel({ state = "open" }: RenderOpts = {}) {
  return render(
    <WorkspacePanel
      selectedThread={thread}
      state={state}
      onToggle={vi.fn()}
      onExpand={vi.fn()}
    />,
  )
}

describe("WorkspacePanel — derived-panel gate (GAP-1 / WORKSPACE-PARITY)", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    })
    setHooks({})
  })

  // Test A — the headline guard. A no-write_todos multi-step run (real todos/files/
  // asks/phases all empty) but with a derived panel MUST fill the Todos section with
  // the activity-derived rows + the "derived from activity" marker, NOT PanelEmpty.
  // Before the Task-2 fix this FAILS: hasActivity omits the derived signal → the
  // panel short-circuits to <PanelEmpty/> and the real TodosSection never mounts.
  it("fills the Todos panel with derived rows when only tool-call activity earns a derived panel", () => {
    setHooks({
      todos: [],
      files: [],
      asks: [],
      phases: [],
      derived: [
        { label: "Create CSV file", status: "completed" },
        { label: "Create chart", status: "in_progress" },
      ],
    })
    renderPanel({ state: "open" })

    expect(screen.getByText(/derived from activity/i)).toBeInTheDocument()
    expect(screen.getByText("Create CSV file")).toBeInTheDocument()
    expect(screen.getByText("Create chart")).toBeInTheDocument()
    expect(screen.queryByText(/No workspace activity yet/i)).toBeNull()
    expect(screen.getByRole("button", { name: /^Todos/i })).toBeInTheDocument()
  })

  // Test B — negative: a genuinely trivial (0/1-tool) thread, derived empty too,
  // stays the calm single PanelEmpty — the derived panel is never forced. (Passes
  // even before the fix — it is the don't-regress guard.)
  it("stays PanelEmpty when there is no real activity AND no derived panel (trivial thread)", () => {
    setHooks({ todos: [], files: [], asks: [], phases: [], derived: [] })
    renderPanel({ state: "open" })

    expect(screen.getByText(/No workspace activity yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/derived from activity/i)).toBeNull()
  })

  // Test C — real-todos precedence still wins via the REAL TodosSection: a real
  // write_todos plan renders, and the derived marker does NOT appear even though a
  // derived array is present (TodosSection precedence 1 — a real plan is never
  // overwritten). WorkspacePanel must still mount the section.
  it("renders the real write_todos plan (precedence 1) and never the derived marker when real todos exist", () => {
    setHooks({
      todos: mockTodos,
      files: [],
      asks: [],
      phases: [],
      derived: [{ label: "Create CSV file", status: "completed" }],
    })
    renderPanel({ state: "open" })

    // Real todo content (from the shared fixture) renders…
    expect(screen.getByText("Read the source dataset")).toBeInTheDocument()
    expect(screen.getByText("Compute the Q3 rollup")).toBeInTheDocument()
    // …and the derived marker / derived label do NOT (precedence preserved).
    expect(screen.queryByText(/derived from activity/i)).toBeNull()
    expect(screen.queryByText("Create CSV file")).toBeNull()
  })

  // Honesty guard — when activity is derived-only (no real todos), the "Todos"
  // section header must NOT show a misleading "0/0" count badge. PanelSection
  // renders no badge when count is undefined.
  it("omits the Todos count badge (no misleading 0/0) when items are derived-only", () => {
    setHooks({
      todos: [],
      files: [],
      asks: [],
      phases: [],
      derived: [{ label: "Create CSV file", status: "completed" }],
    })
    renderPanel({ state: "open" })

    const todosButton = screen.getByRole("button", { name: /^Todos/i })
    expect(todosButton).toBeInTheDocument()
    expect(todosButton.textContent).not.toMatch(/0\s*\/\s*0/)
  })
})

// Mock the WorkspaceFile fixture is referenced to keep the import meaningful even
// though the Files section is sentinel-mocked (Test C drives the real Todos path).
void mockWorkspaceFiles
