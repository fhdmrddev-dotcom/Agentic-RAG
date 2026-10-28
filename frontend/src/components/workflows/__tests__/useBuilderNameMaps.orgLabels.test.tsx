/**
 * Phase 298-04 (ORG-05 / D-15 / UI-D11) — a bound folder from another org reads by NAME with
 * where it lives, on the Builder.
 *
 * The narrowed folder list (298-01) no longer holds a folder the workflow binds in another org.
 * `useBuilderNameMaps` therefore asks the folder-labels read for the bound ids the list lacks,
 * ONCE, and merges chip-form names ("Q3 Contracts · lives in Acme Legal") into `folderNames`
 * plus the raw labels into `folderLabels`. The page's bound-folder `<option>` then reads
 * "Q3 Contracts — lives in Acme Legal"; an id the caller cannot see stays UNNAMED_KB_OPTION.
 * Asserted by RENDERED WORDS on the real page, not by testids alone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react"

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
  listFolders: vi.fn(),
  listSkills: vi.fn(),
  listConnectorConnections: vi.fn(),
  getFolderLabels: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  ...api,
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
  generateWorkflow: vi.fn(),
  createWorkflowDraft: vi.fn().mockResolvedValue({ id: "created-1", version: 1, token: "t" }),
  updateWorkflowDraft: vi.fn().mockResolvedValue({ id: "draft-1", version: 1, token: "t" }),
  discoverConnectorTools: () => Promise.resolve([]),
  updateConnectorGrants: () => Promise.resolve({}),
  validateWorkflow: vi.fn().mockResolvedValue({ ok: true, verdicts: [] }),
  getGroundingBundle: vi.fn().mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] }),
  getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
  publishWorkflow: vi.fn(),
  listDraftWorkflows: vi.fn().mockResolvedValue([]),
}))

import { useBuilderNameMaps } from "@/components/workflows/useBuilderNameMaps"
import { WorkflowBuilderPage, type BuilderDefinition } from "@/pages/WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { UNNAMED_KB_OPTION } from "@/components/workflows/builderCopy"
import type { FolderLabel } from "@/lib/api/orgItems"

const IN_ORG = { id: "aaaaaaaa-0000-4000-8000-000000000001", name: "Vendor Contracts" }
const Q3_ID = "aaaaaaaa-0000-4000-8000-0000000000q3"
const SCOPE_ID = "aaaaaaaa-0000-4000-8000-0000000000s1"
const Q3: FolderLabel = { id: Q3_ID, name: "Q3 Contracts", org_id: "org-legal", org_name: "Acme Legal" }
const SCOPE: FolderLabel = { id: SCOPE_ID, name: "Board Minutes", org_id: "org-legal", org_name: "Acme Legal" }

function switchOrg(next: string | null) {
  orgStore.set(next)
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  api.listFolders.mockResolvedValue([IN_ORG])
  api.listSkills.mockResolvedValue([])
  api.listConnectorConnections.mockResolvedValue([])
  api.getFolderLabels.mockResolvedValue([])
  switchOrg("org-a")
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  switchOrg(null)
})

describe("useBuilderNameMaps — out-of-org bound folders (298-04)", () => {
  it("asks the label read ONCE for the bound ids the narrowed list lacks, and names them with where they live", async () => {
    api.getFolderLabels.mockResolvedValue([Q3, SCOPE])
    const { result } = renderHook(() =>
      useBuilderNameMaps({
        meta: { project_folder_id: Q3_ID },
        phases: [{ config: { folder_scope: [SCOPE_ID, IN_ORG.id] } }],
      }),
    )
    await waitFor(() => expect(result.current.folderNames[Q3_ID]).toBe("Q3 Contracts · lives in Acme Legal"))
    expect(result.current.folderNames[SCOPE_ID]).toBe("Board Minutes · lives in Acme Legal")
    expect(result.current.folderNames[IN_ORG.id]).toBe("Vendor Contracts")
    expect(result.current.folderLabels[Q3_ID]).toEqual(Q3)
    expect(api.getFolderLabels).toHaveBeenCalledTimes(1)
    expect([...(api.getFolderLabels.mock.calls[0][0] as string[])].sort()).toEqual([Q3_ID, SCOPE_ID].sort())
    // the narrowed options stay the in-org list
    expect(result.current.folderOptions).toEqual([IN_ORG])
  })

  it("asks nothing when every bound id is in the list", async () => {
    const { result } = renderHook(() =>
      useBuilderNameMaps({ meta: { project_folder_id: IN_ORG.id }, phases: [] }),
    )
    await waitFor(() => expect(result.current.folderNames[IN_ORG.id]).toBe("Vendor Contracts"))
    expect(api.getFolderLabels).not.toHaveBeenCalled()
  })

  it("an id the read omits (the caller cannot see it) gets NO name — the page falls back to UNNAMED_KB_OPTION", async () => {
    const { result } = renderHook(() =>
      useBuilderNameMaps({ meta: { project_folder_id: Q3_ID }, phases: [] }),
    )
    await waitFor(() => expect(api.getFolderLabels).toHaveBeenCalledTimes(1))
    expect(result.current.folderNames[Q3_ID]).toBeUndefined()
    expect(result.current.folderLabels[Q3_ID]).toBeUndefined()
  })

  it("a failed label read is non-fatal — the in-org names still land", async () => {
    api.getFolderLabels.mockRejectedValue(new Error("network"))
    const { result } = renderHook(() =>
      useBuilderNameMaps({ meta: { project_folder_id: Q3_ID }, phases: [] }),
    )
    await waitFor(() => expect(result.current.folderNames[IN_ORG.id]).toBe("Vendor Contracts"))
    expect(result.current.folderNames[Q3_ID]).toBeUndefined()
  })

  it("re-reads its three lists when the active org changes (D-08)", async () => {
    const { result } = renderHook(() => useBuilderNameMaps({ meta: null, phases: [] }))
    await waitFor(() => expect(result.current.folderNames[IN_ORG.id]).toBe("Vendor Contracts"))
    expect(api.listFolders).toHaveBeenCalledTimes(1)
    act(() => switchOrg("org-b"))
    await waitFor(() => expect(api.listFolders).toHaveBeenCalledTimes(2))
    expect(api.listSkills).toHaveBeenCalledTimes(2)
    expect(api.listConnectorConnections).toHaveBeenCalledTimes(2)
  })
})

function definitionBoundTo(folderId: string): BuilderDefinition {
  return {
    slug: "vendor-brief",
    version: 1,
    status: "draft",
    business_requirement: "summarize vendor risk",
    project_folder_id: folderId,
    phases: [{ slug: "find", phase_index: 0, config: { phase_type: "llm_agent", prompt: "find" } }],
  } as unknown as BuilderDefinition
}

function renderBuilder(folderId: string, canvas: boolean) {
  const features = canvas ? { visual_workflow_canvas: true } : {}
  return render(
    <EffectiveFeaturesProvider value={{ features, loading: false, refetch: vi.fn() }}>
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowBuilderPage initial={{ definition: definitionBoundTo(folderId), draftId: "draft-1" }} />
      </div>
    </EffectiveFeaturesProvider>,
  )
}

describe("WorkflowBuilderPage — the bound folder from another org (298-04, UI-D11)", () => {
  it("canvas select: the option reads 'Q3 Contracts — lives in Acme Legal'", async () => {
    api.getFolderLabels.mockResolvedValue([Q3])
    renderBuilder(Q3_ID, true)
    const picker = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    await waitFor(() =>
      expect(Array.from(picker.options).map((o) => o.textContent)).toContain("Q3 Contracts — lives in Acme Legal"),
    )
    expect(picker.value).toBe(Q3_ID)
    expect(picker.selectedOptions[0]?.textContent).toBe("Q3 Contracts — lives in Acme Legal")
  })

  it("canvas select: an id the caller cannot see keeps UNNAMED_KB_OPTION, never the raw id", async () => {
    renderBuilder(Q3_ID, true)
    const picker = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    await waitFor(() => expect(api.getFolderLabels).toHaveBeenCalled())
    const labels = Array.from(picker.options).map((o) => o.textContent)
    expect(labels).toContain(UNNAMED_KB_OPTION)
    expect(labels.join(" ")).not.toContain(Q3_ID)
  })

  it("flag-off chip: reads 'Q3 Contracts · lives in Acme Legal' as real text", async () => {
    api.getFolderLabels.mockResolvedValue([Q3])
    renderBuilder(Q3_ID, false)
    const chip = await screen.findByTestId("builder-bound-folder")
    await waitFor(() => expect(chip).toHaveTextContent("Q3 Contracts · lives in Acme Legal"))
    expect(chip.getAttribute("title")).toBeNull()
  })
})
