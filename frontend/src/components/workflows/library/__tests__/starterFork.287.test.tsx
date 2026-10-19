/**
 * Phase 287-04 (START-03, SC#4) -- the starter-fork create payload, pinned at the wire seam.
 *
 * "Make my own copy" on a starter still goes menu -> ForkNameDialog -> create (A-04: the
 * ratified flow is kept; SC#4's "one click" is recorded DEVIATED, operator to rule). What this
 * pins is what reaches `createWorkflowDraft`: a NEW slug (never the starter's), version 1,
 * status draft, the name the person TYPED, and `category` NOT stripped (A-05).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

const createWorkflowDraft = vi.fn()
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  createWorkflowDraft: (...a: unknown[]) => createWorkflowDraft(...a),
}))

import { useWorkflowFork } from "../useWorkflowFork"

const STARTER_DEF = {
  slug: "weekly-status",
  version: 1,
  name: "Weekly Status",
  status: "published",
  category: "starter",
  phases: [],
}

const ROW = {
  slug: "weekly-status",
  source: { id: "s1", slug: "weekly-status", name: "Weekly Status", definition: STARTER_DEF },
} as never

function mount() {
  const onForked = vi.fn()
  const hook = renderHook(() =>
    useWorkflowFork({
      drafts: [],
      rows: [],
      refetchDrafts: vi.fn(),
      onOpenDraft: vi.fn(),
      onForked,
    }),
  )
  return { onForked, ...hook }
}

beforeEach(() => {
  createWorkflowDraft.mockReset()
  createWorkflowDraft.mockResolvedValue({ id: "new-id", version: 1, token: "t" })
})

describe("starter fork payload (287-04)", () => {
  it("asks for a name first (dialog kept) and writes nothing until it is given", () => {
    const { result } = mount()
    act(() => result.current.onForkStarter(ROW))
    expect(result.current.pendingFork?.kind).toBe("starter")
    expect(createWorkflowDraft).not.toHaveBeenCalled()
  })

  it("creates a new-slug, v1, draft copy carrying the TYPED name and keeping category", async () => {
    const { result, onForked } = mount()
    act(() => result.current.onForkStarter(ROW))
    act(() => result.current.confirmFork("  My weekly status  "))
    await waitFor(() => expect(createWorkflowDraft).toHaveBeenCalledTimes(1))
    const body = createWorkflowDraft.mock.calls[0][0] as Record<string, unknown>
    expect(body.slug).not.toBe(STARTER_DEF.slug)
    expect(String(body.slug)).toMatch(/^weekly-status-[a-z0-9]{6}$/)
    expect(body.version).toBe(1)
    expect(body.status).toBe("draft")
    expect(body.name).toBe("My weekly status")
    expect(body.category).toBe("starter")
    await waitFor(() => expect(onForked).toHaveBeenCalledTimes(1))
    expect(onForked.mock.calls[0][0].label).toBe("From starter · My weekly status")
  })

  it("a blank name writes nothing (positive control for the typed-name assertion)", () => {
    const { result } = mount()
    act(() => result.current.onForkStarter(ROW))
    act(() => result.current.confirmFork("   "))
    expect(createWorkflowDraft).not.toHaveBeenCalled()
  })
})
