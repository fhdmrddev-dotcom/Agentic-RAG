/**
 * Phase 298-04 (ORG-02 / D-08 / D-09 / UI-D8 / UI-D10) — the Workflows library follows an org switch.
 *
 * Driven through the real page and its real feeds hook (only the network is faked), with a
 * flippable active org standing in for OrgProvider. Asserted by RENDERED WORDS: after a switch
 * the old org's workflow and draft never show, "Loading your workflows…" shows instead of
 * "You have no workflows yet.", a late old-org answer never repaints, and the project filter
 * is back on All. The header seam flips first, the state second, exactly as `switchOrg` does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react"

configure({ asyncUtilTimeout: 4000 })

const orgStore = vi.hoisted(() => {
  let current: string | null = null
  const subs = new Set<() => void>()
  return {
    get: () => current,
    set: (v: string | null) => {
      current = v
      subs.forEach((f) => f())
    },
    subscribe: (f: () => void) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
  }
})
vi.mock("@/providers/OrgProvider", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    useOrgOptional: () => ({ activeOrgId: useSyncExternalStore(orgStore.subscribe, orgStore.get) }),
  }
})

const api = vi.hoisted(() => ({
  listPublishedWorkflows: vi.fn(),
  listDraftWorkflows: vi.fn(),
  listStarterWorkflows: vi.fn(),
}))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    ...api,
    listSchedules: () => Promise.resolve([]),
    listWorkflowSchedules: () => Promise.resolve([]),
    listFolders: () => Promise.resolve([]),
    listSkills: () => Promise.resolve([]),
  }
})

import { WorkflowsPage } from "@/pages/WorkflowsPage"
import { setActiveOrgId, getActiveOrgId } from "@/lib/api/_core"
import { LIBRARY_STATES } from "@/components/workflows/library/libraryVocabulary"
import type { Folder } from "@/types"

function published(id: string, name: string, projectFolderId: string | null = null) {
  return {
    id,
    slug: id,
    name,
    is_mine: true,
    is_system_global: false,
    updated_at: "2026-10-20T10:00:00Z",
    definition: {
      slug: id,
      version: 1,
      ...(projectFolderId ? { project_folder_id: projectFolderId } : {}),
      inputs: [{ key: "kickoff_prompt" }],
      phases: [{ slug: "p", phase_index: 0, name: "Step", config: { phase_type: "programmatic" } }],
    },
  }
}
function draft(id: string, name: string) {
  return { id, slug: id, version: 1, name, token: `tok-${id}`, definition: { slug: id, version: 1, phases: [] } }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const FEEDS: Record<string, { published: unknown[]; drafts: unknown[] }> = {
  "org-a": { published: [published("wf-a", "Alpha Review", "folder-a")], drafts: [draft("d-a", "Alpha Draft")] },
  "org-b": { published: [published("wf-b", "Bravo Report")], drafts: [] },
}
const feedFor = () => FEEDS[getActiveOrgId() ?? ""] ?? { published: [], drafts: [] }

const folders: Folder[] = [
  { id: "folder-a", user_id: "u1", name: "Alpha Project", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
]

function switchOrg(next: string | null) {
  setActiveOrgId(next)
  orgStore.set(next)
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  switchOrg("org-a")
  api.listPublishedWorkflows.mockImplementation(async () => feedFor().published)
  api.listDraftWorkflows.mockImplementation(async () => feedFor().drafts)
  api.listStarterWorkflows.mockResolvedValue([])
})
afterEach(() => switchOrg(null))

describe("WorkflowsPage — switching org (298-04)", () => {
  it("drops the old org's workflow and draft AT ONCE, says 'Loading your workflows…', then shows the new org's", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    expect(await screen.findByText("Alpha Review")).toBeInTheDocument()
    expect(screen.getByText("Alpha Draft")).toBeInTheDocument()

    const pubB = deferred<unknown[]>()
    const draftsB = deferred<unknown[]>()
    api.listPublishedWorkflows.mockImplementationOnce(() => pubB.promise)
    api.listDraftWorkflows.mockImplementationOnce(() => draftsB.promise)
    act(() => switchOrg("org-b"))

    expect(screen.queryByText("Alpha Review")).toBeNull()
    expect(screen.queryByText("Alpha Draft")).toBeNull()
    expect(screen.getByTestId("library-loading")).toHaveTextContent(LIBRARY_STATES.loading)
    expect(screen.getByText("Loading your workflows…")).toBeInTheDocument()
    expect(screen.queryByText("You have no workflows yet.")).toBeNull()

    await act(async () => {
      pubB.resolve(FEEDS["org-b"].published)
      draftsB.resolve([])
    })
    expect(await screen.findByText("Bravo Report")).toBeInTheDocument()
    expect(screen.queryByTestId("library-loading")).toBeNull()
    expect(screen.queryByText("Alpha Review")).toBeNull()
  })

  it("a slow old-org answer landing after the switch never repaints", async () => {
    const pubA = deferred<unknown[]>()
    api.listPublishedWorkflows.mockImplementationOnce(() => pubA.promise)
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    act(() => switchOrg("org-b"))
    expect(await screen.findByText("Bravo Report")).toBeInTheDocument()
    await act(async () => pubA.resolve(FEEDS["org-a"].published))
    expect(screen.queryByText("Alpha Review")).toBeNull()
    expect(screen.getByText("Bravo Report")).toBeInTheDocument()
  })

  it("the project filter returns to All on a switch (UI-D10), and the new org is asked unfiltered", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    expect(await screen.findByText("Alpha Review")).toBeInTheDocument()
    fireEvent.change(screen.getByTestId("library-project-select"), { target: { value: "folder-a" } })
    await waitFor(() =>
      expect(api.listPublishedWorkflows).toHaveBeenLastCalledWith("folder-a", undefined, { scope: "mine" }),
    )
    act(() => switchOrg("org-b"))
    expect((screen.getByTestId("library-project-select") as HTMLSelectElement).value).toBe("")
    expect(await screen.findByText("Bravo Report")).toBeInTheDocument()
    expect(api.listPublishedWorkflows).toHaveBeenLastCalledWith(null, undefined, { scope: "mine" })
  })

  it("re-asks drafts for the new org (published, drafts and starters all re-read once)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    expect(await screen.findByText("Alpha Review")).toBeInTheDocument()
    expect(api.listDraftWorkflows).toHaveBeenCalledTimes(1)
    expect(api.listPublishedWorkflows).toHaveBeenCalledTimes(1)
    act(() => switchOrg("org-b"))
    expect(await screen.findByText("Bravo Report")).toBeInTheDocument()
    expect(api.listDraftWorkflows).toHaveBeenCalledTimes(2)
    expect(api.listPublishedWorkflows).toHaveBeenCalledTimes(2)
    expect(api.listStarterWorkflows).toHaveBeenCalledTimes(2)
  })
})
