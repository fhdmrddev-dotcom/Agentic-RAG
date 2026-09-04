/**
 * Phase 188 Plan 09 Task 3 (RUNVIZ-03 / SPEC Req 6 / D-188-10..12) — the launch-path
 * wire fence.
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
 * The harness mirrors the shipped `ChatLayout.orgRefetch.test.tsx` posture (the same
 * hook mocks, the same heavy-chrome stubs) rather than inventing a second one.
 *
 * What this suite fences, and why each needs fencing:
 *
 *  1. THE RETARGET. Launching lands on the run surface and never in the chat message
 *     list. This is the whole requirement (D-188-12).
 *  2. THE SURVIVING HALF. `doRun`'s thread-creating half is a guard against
 *     OVER-deleting: the run is still thread-backed (D-14), so `createThread` +
 *     `postMessage({workflowDefinitionId})` must still fire and the thread must still
 *     be the thing the run is anchored to. Req 6's second assertion.
 *  3. THE ID TRAP. Two differently-typed ids share the name `run_id` in this codebase
 *     and BOTH ARE BARE UUIDS, so the compiler cannot catch a swap. The message POST's
 *     response carries the PRODUCER row's id (the one `GET /runs/{id}/stream` consumes);
 *     the run surface is addressed by the `workflow_runs` row, which is what the thread
 *     anchor holds. The two mocks below are therefore given DELIBERATELY DIFFERENT
 *     values, so passing the wrong one is a visible failure rather than a silent one
 *     (T-188-09-01).
 *  4. WR-04. A post-create failure must still best-effort delete the launch shell, still
 *     re-throw the ORIGINAL error, and must NOT navigate anywhere (T-188-09-02).
 *  5. THE STRUCTURAL PROPERTY. "No message list and no composer on the run surface" is a
 *     property of the LAYOUT, not a discipline in the page: the composer, the message
 *     list and the workspace panel all live inside the `activeView === "chat"` branch, so
 *     a view on the else side renders none of them. Asserted with a POSITIVE CONTROL, so
 *     the absence is a measurement of the branch split and not of a broken render.
 *  6. THE POSITIONAL-FALLBACK REPLACEMENT (217.1-14). The trailing else now renders
 *     `<UnknownViewFallback view={activeView as never} />` instead of KnowledgeHealthPage.
 *     A stale or unknown ActiveView value renders visible self-identifying text rather than
 *     a silently-wrong product page.
 *  7. THE FALLBACK DEGRADATION. A null anchor restores the shipped behaviour rather than
 *     navigating to a run surface that cannot resolve its run.
 *  8. A SOURCE FENCE over `ChatLayout.tsx` itself, because 5 and 6 are ORDERING facts
 *     that a render assertion can only observe indirectly.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// ── The two ids. DIFFERENT ON PURPOSE (see header note 3). ────────────────────
/** `threads.active_workflow_run_id` — the `workflow_runs` row. The RIGHT one. */
const ANCHOR_RUN_ID = "wfrun-0000-correct"
/** The id the message POST hands back — the producer row. The WRONG one. */
const PRODUCER_RUN_ID = "prodrun-9999-wrong"

const THREAD_ID = "thread-launched"

const {
  mockCreateThread,
  mockPostMessage,
  mockUploadTemplate,
  mockDeleteThread,
  mockGetThreadWorkflow,
  mockLoadThreads,
  mockSelectThread,
} = vi.hoisted(() => ({
  mockCreateThread: vi.fn(),
  mockPostMessage: vi.fn(),
  mockUploadTemplate: vi.fn(),
  mockDeleteThread: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
  mockLoadThreads: vi.fn(),
  mockSelectThread: vi.fn(),
}))

// The api seam ChatLayout.doRun consumes. `deleteThread` is imported by doRun under the
// `deleteLaunchThread` alias for the WR-04 orphan cleanup.
vi.mock("@/lib/api", () => ({
  // 204-03 (SCHED-01) — THE MEASURED MOCK BUDGET, SPENT IN THE COMMIT THAT ADDED THE EXPORTS.
  // A whole-module `vi.mock("@/lib/api")` factory that omits a newly-added RUNTIME export makes
  // every suite reaching it throw AT MOUNT, far from the cause: `196-08` cost 249 red tests
  // exactly this way. `WorkflowsPage` now mounts `WorkflowScheduleModal`, which imports these
  // six. They resolve to empty/no-op answers because no case here opens the schedules dialog —
  // their job is to EXIST.
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
  createThread: (...a: unknown[]) => mockCreateThread(...(a as [string])),
  postMessage: (...a: unknown[]) => mockPostMessage(...(a as [string, string, object])),
  uploadWorkspaceTemplate: (...a: unknown[]) => mockUploadTemplate(...(a as [string, File])),
  deleteThread: (...a: unknown[]) => mockDeleteThread(...(a as [string])),
  getThreadWorkflow: (...a: unknown[]) => mockGetThreadWorkflow(...(a as [string])),
}))

vi.mock("@/hooks/useThreads", () => ({
  useThreads: () => ({
    threads: [],
    selectedThread: null,
    loading: false,
    loadThreads: mockLoadThreads,
    selectThread: mockSelectThread,
    newThread: vi.fn().mockResolvedValue({ id: "t-new", title: "New Chat" }),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    renameThread: vi.fn().mockResolvedValue(undefined),
    updateThreadTitle: vi.fn(),
  }),
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))

// ── Heavy chrome, stubbed as leaves. ──────────────────────────────────────────
//
// ⚠ The ChatArea stub renders a message list and a composer BY ROLE. That is not
// decoration: in the shipped tree those two elements are ChatArea's children, and
// ChatArea is mounted ONLY inside the `activeView === "chat"` branch — so ChatArea's
// absence on a non-chat view IS the absence of the composer and the message list. The
// ordering half of that claim is fenced against the real source at the bottom of this
// file, because a stub alone could not prove it.
vi.mock("./NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("./ChatHistoryColumn", () => ({ ChatHistoryColumn: () => <div data-testid="history-stub" /> }))
vi.mock("./ThreadCommandPalette", () => ({ ThreadCommandPalette: () => <div data-testid="palette-stub" /> }))
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="workspace-panel-stub" />,
}))
vi.mock("@/components/chat/ChatArea", () => ({
  ChatArea: () => (
    <div data-testid="chat-area-stub">
      <div data-testid="message-list-stub" />
      <textarea data-testid="composer-stub" />
    </div>
  ),
}))
vi.mock("@/pages/WorkflowRunPage", () => ({
  WorkflowRunPage: ({ runId }: { runId: string | null }) => (
    <div data-testid="run-page-stub">{runId ?? "no-run-id"}</div>
  ),
}))

/** The launch outcome the WorkflowsPage stub records, so the re-throw is observable. */
const launchOutcome: { error: unknown; resolved: boolean } = { error: null, resolved: false }

/** The published def the stubbed launch button hands to `doRun`. */
const DEF = { id: "pub-1", name: "Vendor-risk review" }

// ── Phase 214-12 (STEP-02 / D-214-04) — A DEFINITION THAT ACTUALLY DECLARES INPUTS ──────
//
// ⚠ AUTHORED RATHER THAN BORROWED, AND THAT IS THE FINDING PLAN 214-09 MEASURED. Every
// shipped fixture in this repo declares `inputs: [{ key: "kickoff_prompt" }]` and NOTHING
// ELSE — and `kickoff_prompt` is in `RESERVED_RUN_INPUT_KEYS`, so `launchInputFields` filters
// it out and the field list comes back EMPTY. A suite run against the existing fixtures alone
// would be green while rendering not one field and exercising not one line of this plan.
//
// Two keys on purpose: one WITH an authored label and one WITHOUT, so the two-arm rule is
// exercised through the real component rather than only in its own unit suite.
const DEF_WITH_INPUTS = {
  id: "pub-2",
  name: "Send vendor summary",
  definition: {
    inputs: [{ key: "to", label: "Recipient address" }, { key: "subject" }],
  },
}

/** The shape `WorkflowsPage.tsx:1351` produces after plan 214-09 — ALREADY COLLECTED. */
const LIBRARY_COLLECTED = { to: "already@typed.test", subject: "Q3 numbers" }

// WorkflowsPage is stubbed down to the ONE thing this suite needs from it: the
// `onLaunch` prop, which IS `doRun`. Driving the prop directly keeps the fence on the
// launch WIRING rather than on the library page's card chrome (which has its own suite).
vi.mock("@/pages/WorkflowsPage", () => ({
  WorkflowsPage: ({
    onLaunch,
  }: {
    onLaunch: (
      def: { id: string; name: string; definition?: unknown },
      kickoff: string,
      opts?: {
        templateFile?: File | null
        folderId?: string | null
        inputs?: Record<string, string>
      },
    ) => Promise<void>
  }) => {
    const record = (p: Promise<void>) =>
      void p
        .then(() => {
          launchOutcome.resolved = true
        })
        .catch((e) => {
          launchOutcome.error = e
        })
    return (
      <div data-testid="workflows-stub">
        <button data-testid="drive-launch" onClick={() => record(onLaunch(DEF, "review Acme Corp"))}>
          launch
        </button>
        {/* 214-12 — THE CHAT DOOR: declared inputs, and NO third argument at all. */}
        <button
          data-testid="drive-launch-declared"
          onClick={() => record(onLaunch(DEF_WITH_INPUTS, "send it"))}
        >
          launch declared
        </button>
        {/* 214-12 — THE LIBRARY DOOR: `RunModal` already collected, so `opts.inputs` is
            PRESENT. This is the double-prompt case's driver. */}
        <button
          data-testid="drive-launch-library"
          onClick={() =>
            record(onLaunch(DEF_WITH_INPUTS, "send it", { inputs: LIBRARY_COLLECTED }))
          }
        >
          launch library
        </button>
        {/* 214-12 — the library door WITH a per-run KB-folder override alongside the declared
            keys (T-214-12-04: the collected dict must not displace the override). */}
        <button
          data-testid="drive-launch-library-folder"
          onClick={() =>
            record(
              onLaunch(DEF_WITH_INPUTS, "send it", {
                folderId: "folder-9",
                inputs: LIBRARY_COLLECTED,
              }),
            )
          }
        >
          launch library with folder
        </button>
        {/* 214-12 — THE TEST RUN DOOR, `WorkflowsPage.tsx:909` verbatim in shape: two
            arguments, an EMPTY kickoff, and no third argument. It collects nothing, so it
            inherits the form for free — which is the argument for the gate living in `doRun`
            rather than in each door. */}
        <button
          data-testid="drive-launch-testrun"
          onClick={() => record(onLaunch(DEF_WITH_INPUTS, ""))}
        >
          test run
        </button>
      </div>
    )
  },
}))

import { ChatLayout } from "./ChatLayout"
import chatLayoutSource from "./ChatLayout?raw"
// 214-12: the launch form's own source, fenced below — D-214-04's rejected arm is enforced by
// a measurement over this file, not by the paragraph inside it.
import chatLaunchFormSource from "./ChatLaunchForm?raw"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { ActiveView } from "@/App"

// ── CR-05: the canvas kill switch. ────────────────────────────────────────────────────
//
// The run surface is a canvas-era home, so `visual_workflow_canvas` must gate BOTH the
// navigation and the render — otherwise flipping the operator's off-switch produces the
// one thing REVERT-01 forbids: a surface that did not exist before the canvas was built,
// which then 404s on its own read (the flag-off backend gate) and blames the user's
// account for it.
//
// The provider is a pure value-passing broadcast and a NULL context is FAIL-CLOSED, so
// every render below states its flag explicitly rather than relying on a default.
function withCanvas(on: boolean, node: React.ReactElement) {
  return (
    <EffectiveFeaturesProvider
      value={{ features: on ? { visual_workflow_canvas: true } : {}, loading: false, refetch: vi.fn() }}
    >
      {node}
    </EffectiveFeaturesProvider>
  )
}

function baseProps(activeView: ActiveView, onNavigate = vi.fn()) {
  return {
    onSignOut: vi.fn(),
    activeView,
    onNavigate,
    navItems: [],
    isOperator: false,
    operatorIdentity: null,
    prefillMessage: null,
    onSetPrefillMessage: vi.fn(),
    studioSkillId: null,
    studioTab: "evals" as const,
    onOpenStudio: vi.fn(),
    onReviewEvals: vi.fn(),
    onStudioTabChange: vi.fn(),
    onTuneSkill: vi.fn(),
  }
}

function renderLayout(activeView: ActiveView = "workflows", canvasOn = true) {
  const onNavigate = vi.fn()
  const props = baseProps(activeView, onNavigate)
  const utils = render(withCanvas(canvasOn, <ChatLayout {...props} />))
  /** Re-render the SAME instance on another view (ChatLayout's activeRunId survives). */
  const showView = (view: ActiveView) =>
    utils.rerender(withCanvas(canvasOn, <ChatLayout {...props} activeView={view} />))
  return { ...utils, onNavigate, showView }
}

beforeEach(() => {
  vi.clearAllMocks()
  launchOutcome.error = null
  launchOutcome.resolved = false
  mockCreateThread.mockResolvedValue({ id: THREAD_ID, title: "Vendor-risk review" })
  // The POST response carries the PRODUCER id — the one that must never be navigated with.
  mockPostMessage.mockResolvedValue({ message_id: "m1", run_id: PRODUCER_RUN_ID })
  mockUploadTemplate.mockResolvedValue(undefined)
  mockDeleteThread.mockResolvedValue(undefined)
  mockLoadThreads.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({
    thread_id: THREAD_ID,
    mode: "harness",
    active_workflow_run_id: ANCHOR_RUN_ID,
  })
})

// ── 1. The retarget ───────────────────────────────────────────────────────────

describe("ChatLayout launch — the run gets its own room (SPEC Req 6 / D-188-12)", () => {
  it("navigates to the run surface and NEVER to the chat view", async () => {
    const { onNavigate } = renderLayout()

    fireEvent.click(screen.getByTestId("drive-launch"))

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("workflow-run"))
    expect(onNavigate).not.toHaveBeenCalledWith("chat")
    // Exactly one navigation for one launch — no intermediate hop through chat.
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  // ── 2. The surviving half — the guard against over-deleting ────────────────
  it("still creates the thread and still anchors the run to it", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch"))

    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledTimes(1))
    expect(mockCreateThread).toHaveBeenCalledWith("Vendor-risk review")

    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    expect(mockPostMessage).toHaveBeenCalledWith(THREAD_ID, "review Acme Corp", {
      workflowDefinitionId: "pub-1",
    })

    // The anchor is read off the CREATED thread — that is what makes the run
    // thread-backed (D-14) and what Req 6's second assertion is about.
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalledWith(THREAD_ID))

    // A successful launch never deletes the thread it just created (WR-04's other half).
    expect(mockDeleteThread).not.toHaveBeenCalled()
  })

  // ── 3. The id trap (T-188-09-01) ───────────────────────────────────────────
  it("hands the run surface the ANCHOR id, never the producer id from the POST response", async () => {
    const { showView } = renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch"))
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())

    // App would flip activeView in response to onNavigate; ChatLayout's activeRunId
    // is its own state and survives the re-render.
    showView("workflow-run")

    const page = await screen.findByTestId("run-page-stub")
    expect(page).toHaveTextContent(ANCHOR_RUN_ID)
    // The two fixtures differ on purpose, so the WRONG id is detectable rather than
    // silently equal to the right one. Both are bare-uuid-shaped strings in production.
    expect(page).not.toHaveTextContent(PRODUCER_RUN_ID)
    expect(ANCHOR_RUN_ID).not.toBe(PRODUCER_RUN_ID)
  })

  // ── 4. WR-04 (T-188-09-02) ─────────────────────────────────────────────────
  it("WR-04: a failed launch cleans up the thread, re-throws, and navigates NOWHERE", async () => {
    const boom = new Error("template failed validation (422)")
    mockPostMessage.mockRejectedValue(boom)
    const { onNavigate } = renderLayout()

    fireEvent.click(screen.getByTestId("drive-launch"))

    // Best-effort orphan cleanup with the created thread's id.
    await waitFor(() => expect(mockDeleteThread).toHaveBeenCalledWith(THREAD_ID))
    // The ORIGINAL error propagates, so RunModal still renders the server's message
    // verbatim — the launch-error surfacing must not regress.
    await waitFor(() => expect(launchOutcome.error).toBe(boom))
    expect(launchOutcome.resolved).toBe(false)
    // And nothing navigated: a failed launch has no room to land in.
    expect(onNavigate).not.toHaveBeenCalled()
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })

  // ── 7. The deliberate degradation ──────────────────────────────────────────
  it("a null anchor restores the shipped behaviour instead of opening a run it cannot resolve", async () => {
    mockGetThreadWorkflow.mockResolvedValue({
      thread_id: THREAD_ID,
      mode: "deep",
      active_workflow_run_id: null,
    })
    const { onNavigate } = renderLayout()

    fireEvent.click(screen.getByTestId("drive-launch"))

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("chat"))
    expect(mockSelectThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: THREAD_ID }),
    )
    expect(onNavigate).not.toHaveBeenCalledWith("workflow-run")
  })

  it("a FAILED anchor read also degrades to the shipped behaviour — the launch already succeeded", async () => {
    // This read happens AFTER a successful launch. A blip here must never be reported
    // as a failed launch, and must never strand the user on an unresolvable surface.
    mockGetThreadWorkflow.mockRejectedValue(new Error("network"))
    const { onNavigate } = renderLayout()

    fireEvent.click(screen.getByTestId("drive-launch"))

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("chat"))
    await waitFor(() => expect(launchOutcome.resolved).toBe(true))
    expect(launchOutcome.error).toBeNull()
    expect(mockDeleteThread).not.toHaveBeenCalled()
  })
})

// ── CR-05. The canvas kill switch gates the whole home ────────────────────────
//
// `WorkflowBuilderPage` gates its canvas on `visual_workflow_canvas === true`. The fourth
// home did not: `WorkflowRunPage` read no feature map and `doRun` navigated to it
// unconditionally. `getThreadWorkflow` is NOT canvas-gated, so the anchor resolved fine
// with the flag off and the shipped fallback was never taken. With the switch off,
// launching therefore
//   (1) landed on a surface that did not exist before the canvas was built — REVERT-01
//       byte-identity broken at the LAYOUT level;
//   (2) immediately 404'd on the run read (the flag-off backend gate) and rendered "It may
//       have been deleted, or it belongs to another account" — both stated reasons FALSE,
//       the real one being the operator's kill switch;
//   (3) offered only a link back to Workflows, while `doRun` had not selected the thread
//       either — so the live run was unreachable from the UI in exactly the state the
//       kill switch exists to make safest.
//
// Both halves are gated, deliberately: the NAVIGATION (so a launch never leaves for it)
// and the RENDER (so a stale `activeView` cannot resurrect it). Gating only the render
// would leave a launch stranded on the positional fallback; gating only the navigation
// would leave the home reachable from any surviving pointer.

describe("ChatLayout — the run home is gated on visual_workflow_canvas (CR-05)", () => {
  it("a flag-off launch restores the shipped behaviour: select the thread, land in chat", async () => {
    const { onNavigate } = renderLayout("workflows", false)

    fireEvent.click(screen.getByTestId("drive-launch"))

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("chat"))
    expect(onNavigate).not.toHaveBeenCalledWith("workflow-run")
    // The thread is SELECTED — this is the half that made the flag-off launch a dead end.
    expect(mockSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: THREAD_ID }))
    // The launch itself is untouched: still created, still kicked off, still not deleted.
    expect(mockCreateThread).toHaveBeenCalledTimes(1)
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(mockDeleteThread).not.toHaveBeenCalled()
  })

  it("does not even resolve the run anchor while off — the extra read is canvas-era too", async () => {
    renderLayout("workflows", false)
    fireEvent.click(screen.getByTestId("drive-launch"))
    await waitFor(() => expect(mockPostMessage).toHaveBeenCalled())
    await waitFor(() => expect(mockSelectThread).toHaveBeenCalled())
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })

  it("a stale workflow-run view renders the UnknownViewFallback, never the run surface, while off", () => {
    render(withCanvas(false, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.queryByTestId("run-page-stub")).not.toBeInTheDocument()
    expect(screen.getByText(/This view has no screen/)).toBeInTheDocument()
  })

  it("POSITIVE CONTROL — the same view with the flag ON does render the run surface", () => {
    render(withCanvas(true, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.getByTestId("run-page-stub")).toBeInTheDocument()
    expect(screen.queryByText(/This view has no screen/)).not.toBeInTheDocument()
  })

  it("hands the panel NO run-receipt callback while off — the receipt cannot render", () => {
    // The receipt is the OTHER door into this home. It renders nothing without the
    // callback (its own suite fences that), so withholding the callback is what removes
    // the affordance rather than leaving a control that opens a fallback page.
    const code = codeOf(chatLayoutSource)
    expect(code).toMatch(/onOpenRun=\{canvasEnabled \? openRunSurface : undefined\}/)
  })
})

// ── 5 + 6. The structural properties of the branch split ──────────────────────

describe("ChatLayout — the run surface is on the non-chat side of the split", () => {
  it("renders NO message list and NO composer on the run surface (with the positive control)", () => {
    // POSITIVE CONTROL FIRST: on the chat view both elements DO render, so their absence
    // below is a measurement of the branch split and not of a broken render.
    const chat = render(withCanvas(true, <ChatLayout {...baseProps("chat")} />))
    expect(screen.getByTestId("message-list-stub")).toBeInTheDocument()
    expect(screen.getByTestId("composer-stub")).toBeInTheDocument()
    expect(screen.getByTestId("workspace-panel-stub")).toBeInTheDocument()
    chat.unmount()

    render(withCanvas(true, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.queryByTestId("message-list-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("composer-stub")).not.toBeInTheDocument()
    // The workspace panel goes with them — which is exactly why the run surface has to
    // render its own deliverable list (Plan 10).
    expect(screen.queryByTestId("workspace-panel-stub")).not.toBeInTheDocument()
    expect(screen.getByTestId("run-page-stub")).toBeInTheDocument()
  })

  it("is NOT the UnknownViewFallback — the run surface renders instead", () => {
    render(withCanvas(true, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.queryByText(/This view has no screen/)).not.toBeInTheDocument()
    expect(screen.getByTestId("run-page-stub")).toBeInTheDocument()
    screen.getByTestId("run-page-stub").remove()
  })
})

// ── 8. The source fence — the ORDERING facts a render cannot observe ──────────
//
// ⚠ THE FENCE READS STRIPPED-COMMENT CODE, and that is load-bearing. `ChatLayout.tsx`
// is a heavily-commented file whose comments legitimately quote the very branch
// conditions and component names this fence counts — measured: the branch condition
// appears twice in the file, once as CODE and once inside the prose explaining why no
// nav-rail item claims the view. Indexing the raw source would let a deleted branch keep
// passing on the strength of the paragraph describing it (the 187-24 lesson, resolved the
// way 188-07 and 188-08 resolved it). The stripper itself is tested first, because a
// fence anchored on a broken stripper is a fence that silently passes.
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

const CHAT_LAYOUT_CODE = codeOf(chatLayoutSource)

describe("ChatLayout — source fence: branch order and the chat-only chrome", () => {
  it("the comment stripper works — and this file really does carry the tokens in prose", () => {
    // The precondition that makes stripping necessary: the raw source carries the branch
    // condition MORE times than the code does.
    const NEEDLE = `activeView === "workflow-run"`
    const raw = chatLayoutSource.split(NEEDLE).length - 1
    const stripped = CHAT_LAYOUT_CODE.split(NEEDLE).length - 1
    expect(raw).toBeGreaterThan(stripped)
    expect(stripped).toBe(1)

    // And the stripper removes the token from BOTH comment forms while leaving code.
    const sample = codeOf(`const keep = 1 // drop-me-line\n/* drop-me-block */\nconst also = 2`)
    expect(sample).not.toMatch(/drop-me-line/)
    expect(sample).not.toMatch(/drop-me-block/)
    expect(sample).toMatch(/const keep = 1/)
    expect(sample).toMatch(/const also = 2/)
  })

  it("places the run-surface branch BEFORE the trailing UnknownViewFallback", () => {
    const branch = CHAT_LAYOUT_CODE.indexOf(`activeView === "workflow-run"`)
    // ⚠ Match the JSX TAG (with the `<`), not the bare identifier — the module's IMPORT
    // also spells `UnknownViewFallback`, and indexOf would otherwise resolve to line 13's
    // import rather than the trailing element this ordering assertion is about.
    const fallback = CHAT_LAYOUT_CODE.indexOf("<UnknownViewFallback")
    expect(branch).toBeGreaterThan(-1)
    expect(fallback).toBeGreaterThan(-1)
    expect(branch).toBeLessThan(fallback)
  })

  it("mounts ChatArea and WorkspacePanel ONLY inside the chat branch", () => {
    // The else branch opens with the non-chat <main>. Everything after that index is on
    // the side of the split the run surface lives on.
    const elseBranch = CHAT_LAYOUT_CODE.indexOf(`<main className="flex-1 overflow-hidden">`)
    expect(elseBranch).toBeGreaterThan(-1)

    for (const tag of ["<ChatArea", "<WorkspacePanel"]) {
      const first = CHAT_LAYOUT_CODE.indexOf(tag)
      expect(first).toBeGreaterThan(-1)
      // Mounted before the split point…
      expect(first).toBeLessThan(elseBranch)
      // …and never again after it.
      expect(CHAT_LAYOUT_CODE.indexOf(tag, elseBranch)).toBe(-1)
    }

    // POSITIVE CONTROL — the "never again after it" probe really does find a tag that IS
    // present after the split point, so the -1 above is a measurement, not a tautology.
    expect(CHAT_LAYOUT_CODE.indexOf("UnknownViewFallback", elseBranch)).toBeGreaterThan(-1)
  })

  it("resolves the run id from the thread anchor, and names neither of the wrong-id tokens", () => {
    expect(CHAT_LAYOUT_CODE).toMatch(/active_workflow_run_id/)
    // Needles assembled from parts so this file's own source could not satisfy a grep run
    // over the wider file set (the 187-24 lesson).
    const WRONG_TYPE = ["PostMessage", "Response"].join("")
    const WRONG_FIELD = ["res", ".run_id"].join("")
    expect(chatLayoutSource).not.toMatch(new RegExp(WRONG_TYPE))
    expect(chatLayoutSource).not.toMatch(new RegExp(WRONG_FIELD))
    // POSITIVE CONTROL — both assembled needles really do match the shapes they forbid.
    expect("import type { PostMessageResponse } from '@/lib/api'").toMatch(new RegExp(WRONG_TYPE))
    expect("setActiveRunId(res.run_id)").toMatch(new RegExp(WRONG_FIELD))
  })
})

// ── 214-12 (STEP-02 / D-214-04). THE CHAT LAUNCH MOMENT ───────────────────────
//
// Chat had none. `BUG-260826-01` is that gap seen from the operator's side: a `send_email`
// step launched from a thread received nothing and its recipient resolved to `None`.
//
// ⚠ THE DOM IS NOT THE PROOF, and that is this block's organising rule. A form that renders
// and whose values never reach `create_workflow_run.inputs` fails IDENTICALLY to no form at
// all — which is the bug's own shape one layer up. Every assertion that matters below is on
// the argument object handed to `postMessage`, never on what appeared on screen.

describe("ChatLayout — chat collects declared inputs BEFORE anything is created (D-214-04)", () => {
  it("opens the form and creates NO thread until it is confirmed", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))

    // The ask is up…
    expect(await screen.findByTestId("chat-launch-form")).toBeInTheDocument()
    // …and NOTHING has been created. The form resolves BEFORE createThread precisely so a
    // launch nobody finished leaves no resource behind.
    expect(mockCreateThread).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledTimes(1))
  })

  it("renders a field per DECLARED key, through the SHARED renderer", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))
    const form = await screen.findByTestId("chat-launch-form")

    // The testids come from `LaunchInputFields` — the same leaf the library modal renders,
    // which is what makes "one field renderer serves all three launchers" observable here.
    expect(screen.getByTestId("run-input-to")).toBeInTheDocument()
    expect(screen.getByTestId("run-input-subject")).toBeInTheDocument()
    // Two arms, never three: the authored label is prose, the bare key is the key.
    expect(form).toHaveTextContent("Recipient address")
    expect(form).toHaveTextContent("subject")
  })

  it("CANCEL creates nothing, cleans nothing up, and navigates nowhere", async () => {
    const { onNavigate } = renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))
    await screen.findByTestId("chat-launch-form")

    fireEvent.click(screen.getByTestId("chat-launch-cancel"))

    await waitFor(() =>
      expect(screen.queryByTestId("chat-launch-form")).not.toBeInTheDocument(),
    )
    // ⚠ BOTH AT ZERO. The WR-04 orphan cleanup exists for a launch that FAILED; a launch the
    // person chose not to start must never enter it, because nothing was created to clean.
    expect(mockCreateThread).not.toHaveBeenCalled()
    expect(mockDeleteThread).not.toHaveBeenCalled()
    expect(mockPostMessage).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("CONFIRM forwards the typed dict inside postMessage's `inputs` option", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))
    await screen.findByTestId("chat-launch-form")

    fireEvent.change(screen.getByTestId("run-input-to"), {
      target: { value: "vendor@example.test" },
    })
    fireEvent.change(screen.getByTestId("run-input-subject"), {
      target: { value: "Q3 vendor summary" },
    })
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))

    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    // THE ARGUMENT OBJECT, not the DOM. This is the assertion `BUG-260826-01` is about.
    expect(mockPostMessage).toHaveBeenCalledWith(THREAD_ID, "send it", {
      workflowDefinitionId: "pub-2",
      inputs: { to: "vendor@example.test", subject: "Q3 vendor summary" },
    })
  })

  it("an untouched field sends an empty string — every declared key is PRESENT", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))
    await screen.findByTestId("chat-launch-form")
    fireEvent.change(screen.getByTestId("run-input-to"), { target: { value: "a@b.test" } })
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))

    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    const sent = mockPostMessage.mock.calls[0][2] as { inputs: Record<string, string> }
    // No required-ness is validated at any launcher (the publish gate already refuses an
    // undeclared `ask` key). `""` is a real answer, and PRESENCE is asserted rather than the
    // value alone: absent and empty are DIFFERENT facts on the wire.
    expect(Object.prototype.hasOwnProperty.call(sent.inputs, "subject")).toBe(true)
    expect(sent.inputs.subject).toBe("")
  })
})

// ── ⭐ THE DOUBLE-PROMPT CASE, and the silent-drop case ────────────────────────
//
// These two are the failures this plan would have SHIPPED, not crashed on. `doRun` is the
// launcher for three measured doors; gating the form on the declared list alone would open it
// ON TOP OF a library Run that had just collected the same values — asking one person twice
// for one launch. The silent-drop variant is worse: `WorkflowsPageProps.onLaunch` can carry
// `inputs` while a narrower `doRun` stays assignable under parameter CONTRAVARIANCE, so the
// key typechecks, is discarded, and every build stays green.

describe("ChatLayout — ONE collection point per launch (the double-prompt fence)", () => {
  it("does NOT ask again when the caller already collected (the library door)", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-library"))

    // The launch runs straight through — no second ask on top of RunModal's.
    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId("chat-launch-form")).not.toBeInTheDocument()
    // …and what the person already typed arrives INTACT rather than being discarded.
    expect(mockPostMessage).toHaveBeenCalledWith(THREAD_ID, "send it", {
      workflowDefinitionId: "pub-2",
      inputs: LIBRARY_COLLECTED,
    })
  })

  it("POSITIVE CONTROL — the SAME definition DOES open the form when `inputs` is absent", async () => {
    // Without this the absence above is free: a form that never mounts for any input would
    // pass it. Same def, same fields, only the third argument differs.
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))
    expect(await screen.findByTestId("chat-launch-form")).toBeInTheDocument()
  })

  it("⭐ SILENT-DROP: the exact key/value handed to doRun reaches postMessage, at RUNTIME", async () => {
    // ⚠ `tsc` CANNOT GIVE YOU THIS. Under contravariance a narrower `opts` parameter is still
    // assignable to the widened prop, so the extra key would be silently discarded by a build
    // that stayed green. Only a value read off the real call can tell.
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-library"))
    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))

    const sent = mockPostMessage.mock.calls[0][2] as { inputs?: Record<string, string> }
    expect(Object.prototype.hasOwnProperty.call(sent, "inputs")).toBe(true)
    for (const [k, v] of Object.entries(LIBRARY_COLLECTED)) {
      expect(sent.inputs?.[k]).toBe(v)
    }
  })

  it("T-214-12-04: the collected keys ride ALONGSIDE the KB-folder override, not over it", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-library-folder"))
    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))

    expect(mockPostMessage).toHaveBeenCalledWith(THREAD_ID, "send it", {
      workflowDefinitionId: "pub-2",
      folderId: "folder-9",
      inputs: LIBRARY_COLLECTED,
    })
  })

  it("the TEST RUN door — two arguments, empty kickoff — DOES open the form", async () => {
    // `WorkflowBuilderPage` calls `onTestRun`; `WorkflowsPage.tsx:907-923` adapts it and
    // invokes `onLaunch(def, "")` at `:909` with no third argument. It collects nothing, so it
    // inherits the ask — which is why the gate lives in `doRun` and not in each door.
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-testrun"))
    expect(await screen.findByTestId("chat-launch-form")).toBeInTheDocument()
    expect(mockCreateThread).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    expect(mockPostMessage.mock.calls[0][1]).toBe("")
  })
})

// ── THE REAL REGRESSION FENCE: a definition declaring nothing is UNCHANGED ─────

describe("ChatLayout — a workflow with no declared inputs launches exactly as today", () => {
  it("mounts no form, adds no await, and posts the byte-identical body", async () => {
    // `DEF` carries no `definition` at all, which is the shipped shape the six cases above
    // drive. ⚠ Note what this asserts about the OPTIONS OBJECT: exactly one key. The `inputs`
    // spread is CONDITIONAL for the same reason `workflow_definition_id` and `folder_id` are —
    // an always-present key would change the request body of every launch in the product.
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch"))

    await waitFor(() => expect(mockPostMessage).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId("chat-launch-form")).not.toBeInTheDocument()
    expect(mockPostMessage.mock.calls[0][2]).toEqual({ workflowDefinitionId: "pub-1" })
  })

  it("POSITIVE CONTROL — the probe really can find the form when one is owed", async () => {
    renderLayout()
    fireEvent.click(screen.getByTestId("drive-launch-declared"))
    expect(await screen.findByTestId("chat-launch-form")).toBeInTheDocument()
  })
})

// ── ⛔ D-214-04's REJECTED ARM, enforced rather than noted ─────────────────────

describe("ChatLaunchForm — the agent fills NOTHING (T-214-12-01)", () => {
  const FORM_CODE = codeOf(chatLaunchFormSource)

  it("the stripper really removed this file's prose — the fence is not reading comments", () => {
    expect(FORM_CODE.length).toBeLessThan(chatLaunchFormSource.length)
    const sample = codeOf(`const keep = 1 // drop-me-line\r\n/* drop-me-block */\r\nconst also = 2`)
    expect(sample).not.toMatch(/drop-me-line/)
    expect(sample).not.toMatch(/drop-me-block/)
    expect(sample).toMatch(/const keep = 1/)
  })

  it("reads no conversation, no thread state and no model output", () => {
    // Needles assembled from parts so this suite's own source cannot satisfy a grep run over
    // the wider file set (the 187-24 lesson).
    const CONVO = ["mess", "ages"].join("")
    const ROLE = ["assist", "ant"].join("")
    const LAST = ["last", "Message"].join("")
    const GEN = ["gene", "rate"].join("")
    for (const needle of [CONVO, ROLE, LAST, GEN]) {
      expect(FORM_CODE).not.toContain(needle)
    }
    // POSITIVE CONTROL — every assembled needle really does match the shape it forbids.
    // ⚠ LOWERCASE ON PURPOSE. The first draft of this line read `useMessages()`, whose capital
    // M made the control FAIL against a lowercase needle — the control caught itself, which is
    // the only reason a reader can trust the four absences above.
    expect(`const m = props.mess${"ages"}.at(-1)`).toContain(CONVO)
    expect(`if (m.role === "assist${"ant"}") {}`).toContain(ROLE)
    expect(`const v = last${"Message"}.content`).toContain(LAST)
    expect(`await gene${"rate"}Suggestion()`).toContain(GEN)
  })

  it("its ONLY value source is the `values` state it holds for the person", () => {
    // The component is handed a name and a field list, and hands back a dict. That is the
    // whole of its access — no hook into the thread, no client read.
    expect(FORM_CODE).toContain("useState<Record<string, string>>({})")
    const THREADS_HOOK = ["use", "Threads"].join("")
    const API_MODULE = ["@/lib", "/api"].join("")
    for (const forbidden of [THREADS_HOOK, API_MODULE]) {
      expect(FORM_CODE).not.toContain(forbidden)
    }
    expect(`import { ${THREADS_HOOK} } from "@/hooks/useThreads"`).toContain(THREADS_HOOK)
  })
})

// ── The source fence over the GATE ITSELF ─────────────────────────────────────

describe("ChatLayout — source fence: the second gate term, and no bespoke route", () => {
  it("gates on `opts?.inputs === undefined` in CODE, not only in a test", () => {
    // The second term is what stops a library launch being prompted twice. A test that only
    // drove the behaviour could be satisfied by a fixture; this reads the shipped source.
    expect(CHAT_LAYOUT_CODE).toContain("opts?.inputs === undefined")
    // POSITIVE CONTROL — the stripper leaves code, so a code-only needle is findable.
    expect(CHAT_LAYOUT_CODE).toContain("const doRun = useCallback(")
  })

  it("adds NO bespoke run route — the kickoff path is the shipped one (D-103-CONF-1)", () => {
    // ⚠ Read against STRIPPED code: this file's comments legitimately QUOTE the forbidden
    // route shape while explaining why it is forbidden, and a raw scan would count the
    // paragraph as the violation (the 187-24 lesson).
    expect(CHAT_LAYOUT_CODE).not.toMatch(/workflows\/[^\s"']*\/run\b/)
    // POSITIVE CONTROL — the pattern really does match the shape it forbids.
    expect("/workflows/abc-123/run").toMatch(/workflows\/[^\s"']*\/run\b/)
    // And the shipped kickoff pair is still what launches.
    expect(CHAT_LAYOUT_CODE).toContain("createThread(def.name)")
    expect(CHAT_LAYOUT_CODE).toContain("postMessage(thread.id, kickoff, {")
  })

  it("resolves the ask BEFORE createThread — an ordering a render cannot observe", () => {
    const gate = CHAT_LAYOUT_CODE.indexOf("opts?.inputs === undefined")
    const create = CHAT_LAYOUT_CODE.indexOf("createThread(def.name)")
    expect(gate).toBeGreaterThan(-1)
    expect(create).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(create)
  })
})
