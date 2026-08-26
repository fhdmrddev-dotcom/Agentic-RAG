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
 *  6. THE POSITIONAL-FALLBACK HAZARD. The trailing `<KnowledgeHealthPage />` is a
 *     positional fallback, NOT a `default:` that throws — a union member with no branch
 *     of its own renders Knowledge Health silently (the Phase-118 built-but-unreachable
 *     lesson). Asserted, with a positive control that proves the fallback really is
 *     positional.
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
vi.mock("@/pages/KnowledgeHealthPage", () => ({
  KnowledgeHealthPage: () => <div data-testid="knowledge-health-stub" />,
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

// WorkflowsPage is stubbed down to the ONE thing this suite needs from it: the
// `onLaunch` prop, which IS `doRun`. Driving the prop directly keeps the fence on the
// launch WIRING rather than on the library page's card chrome (which has its own suite).
vi.mock("@/pages/WorkflowsPage", () => ({
  WorkflowsPage: ({
    onLaunch,
  }: {
    onLaunch: (
      def: { id: string; name: string },
      kickoff: string,
      opts?: { templateFile?: File | null; folderId?: string | null },
    ) => Promise<void>
  }) => (
    <div data-testid="workflows-stub">
      <button
        data-testid="drive-launch"
        onClick={() => {
          void onLaunch(DEF, "review Acme Corp")
            .then(() => {
              launchOutcome.resolved = true
            })
            .catch((e) => {
              launchOutcome.error = e
            })
        }}
      >
        launch
      </button>
    </div>
  ),
}))

import { ChatLayout } from "./ChatLayout"
import chatLayoutSource from "./ChatLayout?raw"
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

  it("a stale workflow-run view renders the fallback, never the run surface, while off", () => {
    // The Phase-181 note deferred exactly this assertion to "the first canvas ActiveView
    // render branch". This is it. Falling through to the positional fallback IS the
    // byte-identical answer: a view a never-built feature would not have had behaves like
    // any other unknown member (the `library-health` positive control above).
    render(withCanvas(false, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.queryByTestId("run-page-stub")).not.toBeInTheDocument()
    expect(screen.getByTestId("knowledge-health-stub")).toBeInTheDocument()
  })

  it("POSITIVE CONTROL — the same view with the flag ON does render the run surface", () => {
    render(withCanvas(true, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.getByTestId("run-page-stub")).toBeInTheDocument()
    expect(screen.queryByTestId("knowledge-health-stub")).not.toBeInTheDocument()
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

  it("is NOT the Knowledge-Health positional fallback (with the positive control)", () => {
    render(withCanvas(true, <ChatLayout {...baseProps("workflow-run")} />))
    expect(screen.queryByTestId("knowledge-health-stub")).not.toBeInTheDocument()
    expect(screen.getByTestId("run-page-stub")).toBeInTheDocument()
    screen.getByTestId("run-page-stub").remove()

    // POSITIVE CONTROL: `library-health` is a union member with NO branch of its own, so
    // it falls THROUGH to the trailing element. That proves two things at once — the stub
    // can render, and the trailing element really is a POSITIONAL fallback rather than a
    // `default:` that throws. A `workflow-run` branch placed after it would be dead code.
    const health = render(withCanvas(true, <ChatLayout {...baseProps("library-health")} />))
    expect(screen.getByTestId("knowledge-health-stub")).toBeInTheDocument()
    health.unmount()
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

  it("places the run-surface branch BEFORE the trailing positional fallback", () => {
    const branch = CHAT_LAYOUT_CODE.indexOf(`activeView === "workflow-run"`)
    const fallback = CHAT_LAYOUT_CODE.indexOf("<KnowledgeHealthPage")
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
    expect(CHAT_LAYOUT_CODE.indexOf("<KnowledgeHealthPage", elseBranch)).toBeGreaterThan(-1)
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
