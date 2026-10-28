/**
 * Phase 299-02 (LINK-02 / D-04) — AN EXPERT OPENS FROM ITS ADDRESS.
 *
 * `/app/experts/<id>` opens the Experts catalog with that Expert's detail modal open: from the
 * catalog's ONE grant-aware list read when the Expert is in it, else from `getExpert(id)` (the
 * server's own grant-aware per-Expert read — never the resolver arm, never the management arm).
 * A refused read opens nothing and breaks nothing; closing the modal does not reopen it while the
 * address is unchanged.
 *
 * The second describe drives the WIRE from the address to the page: AppViewSwitch hands
 * `openBundleId` / `linkedDefinitionId` down from App's `entityLink` (props only — it owns no hook).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, listExperts: vi.fn() }
})
vi.mock("@/lib/api/experts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/experts")>("@/lib/api/experts")
  return { ...actual, installExpert: vi.fn(), getExpert: vi.fn() }
})
// Phase 299-03 (D-12): the switch now asks the link gate before it opens a linked id, so the wire
// cases answer the resolver as a system-global item (org_id null opens in the active org, D-35).
vi.mock("@/lib/api/links", () => ({
  resolveLink: vi.fn(async (kind: string, id: string) => ({
    status: "ok",
    target: { kind, id, org_id: null, org_name: null, title: "Item", state: null, audience: "everyone" },
  })),
}))

// The workflows arm of the wire case: the page is stood in by a probe that records its props.
const workflowsProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }))
vi.mock("@/pages/WorkflowsPage", () => ({
  WorkflowsPage: (props: Record<string, unknown>) => {
    workflowsProps.last = props
    return <div data-testid="workflows-probe" />
  },
}))

import * as api from "@/lib/api"
import * as expertsApi from "@/lib/api/experts"
import type { ExpertBundle } from "@/types"
import type { EntityLink } from "@/hooks/useAppNavigation"
import { ExpertCatalogPage } from "../ExpertCatalogPage"
import { AppViewSwitch } from "@/components/layout/AppViewSwitch"

const ID_A = "9f2e4c1a-5d3b-4e8f-a09c-3b4c5d6e7f01"
const ID_B = "9f2e4c1a-5d3b-4e8f-a09c-3b4c5d6e7f02"
const ID_X = "9f2e4c1a-5d3b-4e8f-a09c-3b4c5d6e7f09"

function bundle(id: string, name: string): ExpertBundle {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: "",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    visibility: "granted",
    is_system: false,
    is_enabled: true,
  } as ExpertBundle
}

const A = bundle(ID_A, "Contract Reviewer")
const B = bundle(ID_B, "Margin Watcher")
const X = bundle(ID_X, "Board Pay Advisor")

function renderPage(openBundleId: string | null) {
  const props: ComponentProps<typeof ExpertCatalogPage> = { folders: [], onStartChat: vi.fn(), openBundleId }
  const view = render(<ExpertCatalogPage {...props} />)
  return { ...view, rerenderWith: (id: string | null) => view.rerender(<ExpertCatalogPage {...props} openBundleId={id} />) }
}

beforeEach(() => {
  vi.clearAllMocks()
  workflowsProps.last = null
})

describe("ExpertCatalogPage — openBundleId opens that Expert's detail (D-04)", () => {
  it("an Expert in the loaded list opens its modal, with no second read", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    renderPage(ID_B)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Margin Watcher")).toBeInTheDocument()
    expect(expertsApi.getExpert).not.toHaveBeenCalled()
    expect(api.listExperts).toHaveBeenCalledTimes(1)
  })

  it("an Expert NOT in the list is read once with getExpert(id) and its modal opens on the answer", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    vi.mocked(expertsApi.getExpert).mockResolvedValue(X)
    renderPage(ID_X)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Board Pay Advisor")).toBeInTheDocument()
    expect(expertsApi.getExpert).toHaveBeenCalledTimes(1)
    expect(expertsApi.getExpert).toHaveBeenCalledWith(ID_X)
  })

  it("getExpert is not asked while the list is still loading", async () => {
    let answer: (rows: ExpertBundle[]) => void = () => {}
    vi.mocked(api.listExperts).mockReturnValue(new Promise((r) => (answer = r)))
    renderPage(ID_A)
    await act(async () => {})
    expect(expertsApi.getExpert).not.toHaveBeenCalled()
    await act(async () => answer([A]))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(expertsApi.getExpert).not.toHaveBeenCalled()
  })

  it("a refused getExpert opens nothing and the catalog still renders", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    vi.mocked(expertsApi.getExpert).mockRejectedValue(new Error("Expert not found"))
    renderPage(ID_X)
    await waitFor(() => expect(expertsApi.getExpert).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByText("Contract Reviewer")).toBeInTheDocument()
  })

  it("closing the modal does not reopen it while the address is unchanged", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    const view = renderPage(ID_A)
    const dialog = await screen.findByRole("dialog")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(dialog).not.toBeInTheDocument()
    view.rerenderWith(ID_A)
    await act(async () => {})
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("a different id opens that Expert", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    const view = renderPage(ID_A)
    await screen.findByRole("dialog")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    view.rerenderWith(ID_B)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Margin Watcher")).toBeInTheDocument()
  })

  it("no id opens nothing and reads nothing extra", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    renderPage(null)
    await screen.findByText("Contract Reviewer")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(expertsApi.getExpert).not.toHaveBeenCalled()
  })
})

// ── the wire: AppViewSwitch → the page (props only) ─────────────────────────────────────────
function link(kind: "workflow" | "expert" | "thread", id: string): EntityLink {
  return {
    target: { kind, id },
    route: null,
    openThread: vi.fn(),
    openWorkflow: vi.fn(),
    openExpert: vi.fn(),
    leaveThread: vi.fn(),
    // Phase 299-03: the gate's navigators (address / leave / openRoute / resume).
    address: `/x/${id}`,
    leave: vi.fn(),
    openRoute: vi.fn(),
    resume: vi.fn(),
  }
}

function renderSwitch(activeView: "workflows" | "experts", entityLink: EntityLink | undefined) {
  const noop = vi.fn()
  const props = {
    activeView,
    onNavigate: noop,
    panelState: "rail",
    togglePanel: noop,
    expand: noop,
    threadNavigation: { findThread: () => null, openThread: noop, refreshThreads: async () => {} },
    selectedThread: null,
    newThread: noop,
    patchThread: noop,
    handleTitleUpdate: noop,
    folders: [],
    prefillMessage: null,
    onSetPrefillMessage: noop,
    setDrawerOpen: noop,
    showAttention: false,
    attentionCount: 0,
    historyCollapsed: false,
    setHistoryCollapsedPersisted: noop,
    canvasEnabled: false,
    openRunSurface: noop,
    activeRunId: null,
    doRun: async () => {},
    libraryTab: undefined,
    attentionConditions: [],
    handleAskInChat: async () => false,
    handleTryInChat: noop,
    onTuneSkill: noop,
    onOpenStudio: noop,
    onReviewEvals: noop,
    studioSkillId: null,
    studioTab: "evals",
    onStudioTabChange: noop,
    operatorIdentity: null,
    threads: [],
    selectThread: noop,
    loadThreads: async () => {},
    deleteThread: async () => {},
    entityLink,
  } as unknown as ComponentProps<typeof AppViewSwitch>
  return render(<AppViewSwitch {...props} />)
}

describe("AppViewSwitch — the linked id reaches its page (D-03 / D-04)", () => {
  // RE-TARGETED under 299-03 D-12 (the reason, kept in the body): the switch now asks the server
  // about a linked id before the page opens, so the id reaches the page once the gate's answer is
  // in (here: a system-global item, which opens in the active org). The assertion is unchanged.
  it("a workflow target hands linkedDefinitionId to the Workflows page", async () => {
    renderSwitch("workflows", link("workflow", ID_A))
    expect(await screen.findByTestId("workflows-probe")).toBeInTheDocument()
    expect(workflowsProps.last?.linkedDefinitionId).toBe(ID_A)
  })

  it("no target, or a target of another kind, hands null", async () => {
    renderSwitch("workflows", undefined)
    expect(workflowsProps.last?.linkedDefinitionId).toBeNull()
    renderSwitch("workflows", link("expert", ID_A))
    await act(async () => {})
    expect(workflowsProps.last?.linkedDefinitionId).toBeNull()
  })

  it("an expert target opens that Expert's detail on the real catalog", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    renderSwitch("experts", link("expert", ID_B))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Margin Watcher")).toBeInTheDocument()
  })

  // RE-TARGETED under 299-03 D-12 (the reason, kept in the body): a thread target is now decided by
  // the link gate first. No list here holds the thread, so the gate refuses it with the one card
  // (an empty main region for a chat) and the catalog is never handed the id. The property under
  // test is unchanged: no Expert opens, and no per-Expert read is made.
  it("a thread target on the experts view opens no Expert", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    renderSwitch("experts", link("thread", ID_B))
    expect(await screen.findByRole("heading", { level: 1, name: "This chat can't be opened" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(expertsApi.getExpert).not.toHaveBeenCalled()
  })
})
